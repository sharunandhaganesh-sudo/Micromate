import asyncio
import logging
import math
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from backend.app.core.database import SessionLocal
from backend.app.models.models import Station, Device
from backend.app.services.ingestion import ingestion_service

logger = logging.getLogger(__name__)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class WeatherSimulator:
    def __init__(self):
        self.is_active: bool = False
        self.scenario: str = "normal_weather"
        self.playback_speed: float = 1.0  # 1x, 2x, 5x, 10x
        self.current_step: int = 0
        self.total_steps: int = 1000
        self.interval_seconds: float = 4.0
        self.task: Optional[asyncio.Task] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.boot_id: str = str(uuid.uuid4())
        self.sequence: int = 1
        self.simulated_device_id: str = "esp32-demo-node"
        self.simulated_station_code: str = "STATION-DEMO-01"
        self.last_emitted_timestamp: Optional[datetime] = None

        # Cumulative counters and states
        self.cumulative_rainfall_mm: float = 0.0
        self.base_temperature: float = 24.5
        self.base_pressure: float = 1013.2
        self.base_humidity: float = 58.0
        self.base_wind: float = 3.5
        self.battery_voltage: float = 4.15
        self.wifi_rssi: int = -55

        # Injected overrides
        self.injected_override: Optional[Dict[str, Any]] = None
        self.injected_until_step: int = 0

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def _ensure_task(self):
        loop = self._loop
        if not loop or loop.is_closed():
            try:
                loop = asyncio.get_running_loop()
                self._loop = loop
            except RuntimeError:
                loop = None

        if loop and loop.is_running():
            if not self.task or self.task.done():
                self.task = loop.create_task(self._simulation_loop())
                logger.info("Simulator background loop task created and scheduled.")
        else:
            logger.warning("No running asyncio event loop available for simulator task.")

    def start(self, scenario: Optional[str] = None, speed: Optional[float] = None):
        if scenario:
            self.scenario = scenario
        if speed and speed > 0:
            self.playback_speed = speed
        self.is_active = True
        self._ensure_task()
        logger.info(f"Simulator started: scenario={self.scenario}, speed={self.playback_speed}x, step={self.current_step}")

    def pause(self):
        self.is_active = False
        logger.info(f"Simulator paused at step {self.current_step}")

    def resume(self):
        self.is_active = True
        self._ensure_task()
        logger.info(f"Simulator resumed at step {self.current_step}")

    def stop(self):
        self.is_active = False
        if self.task and not self.task.done():
            self.task.cancel()
            self.task = None
        logger.info("Simulator stopped")

    def reset(self):
        self.stop()
        self.current_step = 0
        self.sequence = 1
        self.boot_id = str(uuid.uuid4())
        self.cumulative_rainfall_mm = 0.0
        self.base_temperature = 24.5
        self.base_pressure = 1013.2
        self.base_humidity = 58.0
        self.base_wind = 3.5
        self.battery_voltage = 4.15
        self.wifi_rssi = -55
        self.injected_override = None
        self.injected_until_step = 0
        logger.info("Simulator reset to initial step 0")

    def set_scenario(self, scenario: str):
        prev = self.scenario
        self.scenario = scenario
        # Reset transient counters when switching scenario
        if scenario != prev:
            self.cumulative_rainfall_mm = 0.0
            self.current_step = 0
            self.injected_override = None
            self.injected_until_step = 0
            # If active, make sure loop continues
            if self.is_active:
                self._ensure_task()
        logger.info(f"Simulator switched to scenario: {scenario}")

    def inject_anomaly(self, metric: str, value: float, duration_steps: int = 15):
        self.injected_override = {"metric": metric, "value": value}
        self.injected_until_step = self.current_step + duration_steps
        # If paused, auto-resume or emit immediately
        if not self.is_active:
            self.start()
        logger.info(f"Injected anomaly: {metric}={value} until step {self.injected_until_step}")

    def get_state(self) -> Dict[str, Any]:
        return {
            "is_active": self.is_active,
            "scenario": self.scenario,
            "playback_speed": self.playback_speed,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "active_station_code": self.simulated_station_code,
            "active_device_identifier": self.simulated_device_id,
            "last_emitted_timestamp": self.last_emitted_timestamp
        }

    async def _simulation_loop(self):
        logger.info("Simulator _simulation_loop running.")
        while self.is_active:
            try:
                await self._emit_step()
                self.current_step += 1
                sleep_duration = max(0.4, self.interval_seconds / self.playback_speed)
                await asyncio.sleep(sleep_duration)
            except asyncio.CancelledError:
                logger.info("Simulator loop cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in simulator loop: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    async def _emit_step(self):
        step = self.current_step
        now = utc_now()
        self.last_emitted_timestamp = now

        # Wi-Fi outage scenario: simulate loss of connection packets
        if self.scenario == "wifi_outage" and (step % 40) in range(10, 26):
            logger.debug(f"Simulator Wi-Fi outage active at step {step} (skipping packet)")
            return

        # Calculate diurnal smooth baseline
        time_angle = (step * 0.08) % (2 * math.pi)
        diurnal_temp = math.sin(time_angle) * 3.0

        temp_c = round(self.base_temperature + diurnal_temp + random.uniform(-0.2, 0.2), 2)
        hum_pct = round(max(20.0, min(95.0, self.base_humidity - diurnal_temp * 1.8 + random.uniform(-0.8, 0.8))), 1)
        press_hpa = round(self.base_pressure + math.cos(time_angle) * 0.8 + random.uniform(-0.1, 0.1), 2)
        wind_mps = round(max(0.8, self.base_wind + random.uniform(-0.6, 0.8)), 2)
        wind_gust = round(wind_mps + random.uniform(0.5, 2.5), 2)
        rain_interval_mm = 0.0
        rain_rate_mmh = 0.0

        # Scenario specific modulations
        if self.scenario == "temperature_spike":
            # Progressively ramp temperature above rule threshold (38.0°C) up to 43°C
            progress = min(1.0, (step % 50) / 25.0)
            temp_c = round(28.0 + progress * 14.5 + random.uniform(-0.3, 0.3), 2)
            hum_pct = round(max(18.0, 48.0 - progress * 24.0), 1)

        elif self.scenario == "heavy_rain":
            # Convective storm: rain rate > 30 mm/h and total > 25 mm
            hum_pct = round(min(99.0, 90.0 + random.uniform(0, 8)), 1)
            press_hpa = round(1002.0 + random.uniform(-0.4, 0.4), 2)
            rain_interval_mm = round(random.uniform(3.2, 6.5), 2)
            self.cumulative_rainfall_mm += rain_interval_mm
            rain_rate_mmh = round(rain_interval_mm * 12.0, 1)  # scaled to mm/hr
            wind_mps = round(random.uniform(8.0, 15.0), 2)
            wind_gust = round(wind_mps + random.uniform(3.0, 7.0), 2)

        elif self.scenario == "strong_wind":
            # Wind speed above rule threshold (18.0 m/s)
            progress = min(1.0, (step % 40) / 15.0)
            wind_mps = round(12.0 + progress * 9.0 + random.uniform(-0.8, 1.2), 2)
            wind_gust = round(wind_mps + random.uniform(4.0, 8.0), 2)
            press_hpa = round(998.0 + random.uniform(-0.5, 0.5), 2)

        elif self.scenario == "rapid_pressure_drop":
            # Severe squall line barometric drop > 4 hPa
            drop = min(12.0, (step % 40) * 0.45)
            press_hpa = round(1012.0 - drop + random.uniform(-0.1, 0.1), 2)
            wind_mps = round(max(2.0, 3.0 + drop * 1.4), 2)
            wind_gust = round(wind_mps + random.uniform(2.0, 5.0), 2)

        elif self.scenario == "sensor_disconnect":
            # Simulates I2C bus error (BME280 disconnected: temp/hum/press = None)
            if (step % 25) in range(8, 18):
                temp_c = None
                hum_pct = None
                press_hpa = None

        elif self.scenario == "battery_decline":
            # Battery drops below 3.4V
            self.battery_voltage = max(3.1, 4.15 - (step * 0.035))

        # Check injected override
        if self.injected_override and step < self.injected_until_step:
            metric = self.injected_override["metric"]
            val = self.injected_override["value"]
            if metric == "temperature_c":
                temp_c = val
            elif metric == "rain_rate_mmh":
                rain_rate_mmh = val
                rain_interval_mm = val / 12.0
                self.cumulative_rainfall_mm += rain_interval_mm
            elif metric == "wind_speed_mps":
                wind_mps = val
                wind_gust = val * 1.3
            elif metric == "pressure_hpa":
                press_hpa = val

        # Calculate battery percentage (linear Li-ion estimation: 3.2V = 0%, 4.2V = 100%)
        batt_pct = round(max(0.0, min(100.0, (self.battery_voltage - 3.2) / (4.2 - 3.2) * 100.0)), 1)

        payload = {
            "schema_version": 1,
            "message_id": f"sim-msg-{uuid.uuid4().hex[:12]}",
            "device_id": self.simulated_device_id,
            "boot_id": self.boot_id,
            "sequence": self.sequence,
            "timestamp": now.isoformat(),
            "uptime_seconds": step * int(self.interval_seconds),
            "firmware_version": "1.0.0-demo",
            "measurements": {
                "temperature_c": temp_c,
                "humidity_pct": hum_pct,
                "pressure_hpa": press_hpa,
                "wind_speed_mps": wind_mps,
                "wind_gust_mps": wind_gust,
                "rainfall_interval_mm": rain_interval_mm,
                "rainfall_total_mm": round(self.cumulative_rainfall_mm, 2),
                "rain_rate_mmh": rain_rate_mmh
            },
            "health": {
                "battery_voltage_v": round(self.battery_voltage, 2),
                "battery_percent": batt_pct,
                "wifi_rssi_dbm": self.wifi_rssi
            }
        }

        self.sequence += 1

        # Ingest payload through ingestion service
        db = SessionLocal()
        try:
            await ingestion_service.ingest_telemetry(db, payload, is_simulated=True)
        finally:
            db.close()

    async def inject_demo_event(self, event_type: str = "custom", metric: Optional[str] = None, value: Optional[float] = None) -> Dict[str, Any]:
        """
        Inject a single, finite, deterministic demonstration event without keeping endless loops active.
        Supports custom metric and value selection, or presets like heavy rain.
        """
        now = utc_now()
        temp_c = 24.5
        hum_pct = 55.0
        press_hpa = 1012.0
        wind_mps = 3.5
        wind_gust = 5.2
        rain_rate_mmh = 0.0
        rain_interval_mm = 0.0

        if metric and value is not None:
            if metric == "temperature_c":
                temp_c = value
            elif metric == "humidity_pct":
                hum_pct = value
            elif metric == "pressure_hpa":
                press_hpa = value
            elif metric == "wind_speed_mps":
                wind_mps = value
                wind_gust = round(value * 1.3, 1)
            elif metric == "rain_rate_mmh":
                rain_rate_mmh = value
                rain_interval_mm = round(value / 12.0, 2)
                self.cumulative_rainfall_mm += rain_interval_mm
            elif metric == "rainfall_total_mm":
                self.cumulative_rainfall_mm = value
                rain_interval_mm = value
        elif event_type == "heavy_rain":
            temp_c = 21.5
            hum_pct = 94.0
            press_hpa = 998.2
            wind_mps = 14.2
            wind_gust = 18.5
            rain_rate_mmh = 48.0
            rain_interval_mm = 4.0
            self.cumulative_rainfall_mm += rain_interval_mm
        elif event_type == "heat_wave" or event_type == "temperature":
            temp_c = 41.5
            hum_pct = 22.0
            press_hpa = 1010.5
            wind_mps = 3.5
            wind_gust = 5.0
            rain_rate_mmh = 0.0
            rain_interval_mm = 0.0

        payload = {
            "schema_version": 1,
            "message_id": f"demo-burst-{uuid.uuid4().hex[:12]}",
            "device_id": self.simulated_device_id,
            "boot_id": self.boot_id,
            "sequence": self.sequence,
            "timestamp": now.isoformat(),
            "uptime_seconds": 3600,
            "firmware_version": "1.0.0-demo",
            "measurements": {
                "temperature_c": temp_c,
                "humidity_pct": hum_pct,
                "pressure_hpa": press_hpa,
                "wind_speed_mps": wind_mps,
                "wind_gust_mps": wind_gust,
                "rainfall_interval_mm": rain_interval_mm,
                "rainfall_total_mm": round(self.cumulative_rainfall_mm, 2),
                "rain_rate_mmh": rain_rate_mmh
            },
            "health": {
                "battery_voltage_v": 3.95,
                "battery_percent": 82.0,
                "wifi_rssi_dbm": -64
            }
        }

        self.sequence += 1
        self.last_emitted_timestamp = now

        db = SessionLocal()
        try:
            res = await ingestion_service.ingest_telemetry(db, payload, is_simulated=True)
            return {
                "status": "success",
                "event_injected": event_type,
                "measurements": payload["measurements"],
                "ingestion_result": res
            }
        finally:
            db.close()

simulator = WeatherSimulator()
