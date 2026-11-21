import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from backend.app.models.models import (
    Device, Station, TelemetryMessage, Measurement, SensorConfiguration
)
from backend.app.schemas.schemas import TelemetryPayloadV1
from backend.app.services.event_engine import event_engine
from backend.app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class IngestionService:
    def __init__(self):
        # Keep track of last sequence and last values for jump/stuck checks per device
        self._device_state: Dict[str, Dict[str, Any]] = {}

    async def ingest_telemetry(
        self,
        db: Session,
        payload_data: Dict[str, Any],
        is_simulated: bool = False,
        authenticated_device_id: Optional[str] = None
    ) -> Tuple[bool, str, Optional[Measurement]]:
        """
        Validates, normalizes, applies calibrations, detects quality flags,
        persists telemetry and measurements, evaluates event rules, and broadcasts.
        """
        # 1. Schema Validation
        try:
            telemetry = TelemetryPayloadV1(**payload_data)
        except Exception as e:
            logger.warning(f"Malformed telemetry rejected: {e}")
            return False, f"Schema validation error: {str(e)}", None

        # 2. Authorization match
        if authenticated_device_id and authenticated_device_id != telemetry.device_id:
            logger.warning(
                f"Device mismatch! Auth device: {authenticated_device_id}, Payload: {telemetry.device_id}"
            )
            return False, "Payload device_id does not match authenticated identity", None

        # 3. Lookup Device
        device = db.query(Device).filter(Device.device_identifier == telemetry.device_id).first()
        if not device:
            # Auto-register if simulated or reject if real
            if is_simulated:
                # Find default demo station
                demo_station = db.query(Station).filter(Station.is_demo == True).first()
                station_id = demo_station.id if demo_station else None
                device = Device(
                    station_id=station_id,
                    device_identifier=telemetry.device_id,
                    name=f"Simulated Node ({telemetry.device_id})",
                    hardware_profile="Simulated Weather Station",
                    firmware_version=telemetry.firmware_version or "1.0.0",
                    is_demo=True,
                    status="ONLINE"
                )
                db.add(device)
                db.flush()
            else:
                return False, f"Unregistered device '{telemetry.device_id}'. Please register device first.", None

        # 4. Idempotency Check (Message ID)
        existing_msg = db.query(TelemetryMessage).filter(
            TelemetryMessage.device_id == device.id,
            TelemetryMessage.message_id == telemetry.message_id
        ).first()
        if existing_msg:
            logger.info(f"Duplicate message_id '{telemetry.message_id}' ignored (idempotent).")
            existing_meas = db.query(Measurement).filter(Measurement.telemetry_id == existing_msg.id).first()
            return True, "Duplicate message ignored", existing_meas

        # 5. Sequence & Reboot Handling
        dev_state = self._device_state.setdefault(device.id, {
            "last_sequence": None,
            "last_boot_id": None,
            "repeated_counts": {},
            "last_values": {},
            "last_rainfall_total": None
        })

        if telemetry.boot_id and dev_state["last_boot_id"] and dev_state["last_boot_id"] != telemetry.boot_id:
            logger.info(f"Device {device.device_identifier} rebooted (boot_id changed). Resetting sequence tracker.")
            dev_state["last_sequence"] = None
        dev_state["last_boot_id"] = telemetry.boot_id

        if telemetry.sequence is not None:
            if dev_state["last_sequence"] is not None and telemetry.sequence < dev_state["last_sequence"]:
                logger.warning(
                    f"Out of order sequence or counter reset for {device.device_identifier}: "
                    f"got {telemetry.sequence}, expected > {dev_state['last_sequence']}"
                )
            dev_state["last_sequence"] = telemetry.sequence

        # 6. Apply Sensor Calibration
        sensors = db.query(SensorConfiguration).filter(
            SensorConfiguration.device_id == device.id,
            SensorConfiguration.enabled == True
        ).all()
        calibrations = {s.sensor_type: (s.calibration_factor, s.calibration_offset) for s in sensors}

        raw_m = telemetry.measurements
        temp_c = raw_m.temperature_c
        hum_pct = raw_m.humidity_pct
        press_hpa = raw_m.pressure_hpa
        wind_mps = raw_m.wind_speed_mps
        wind_gust = raw_m.wind_gust_mps
        rain_interval = raw_m.rainfall_interval_mm
        rain_total = raw_m.rainfall_total_mm
        rain_rate = raw_m.rain_rate_mmh
        rain_wetness = raw_m.rain_wetness_pct

        # Apply calibration equations: val = val * factor + offset
        if temp_c is not None and "BME280_TEMP" in calibrations:
            f, o = calibrations["BME280_TEMP"]
            temp_c = round(temp_c * f + o, 2)
        if hum_pct is not None and "BME280_HUM" in calibrations:
            f, o = calibrations["BME280_HUM"]
            hum_pct = min(100.0, max(0.0, round(hum_pct * f + o, 1)))
        if press_hpa is not None and "BME280_PRESS" in calibrations:
            f, o = calibrations["BME280_PRESS"]
            press_hpa = round(press_hpa * f + o, 2)
        if wind_mps is not None and "ANEMOMETER" in calibrations:
            f, o = calibrations["ANEMOMETER"]
            wind_mps = round(wind_mps * f + o, 2)
        if rain_interval is not None and "RAIN_GAUGE" in calibrations:
            f, o = calibrations["RAIN_GAUGE"]
            rain_interval = round(rain_interval * f + o, 2)

        # 7. Rain rate / rollover handling
        if rain_total is not None:
            if dev_state["last_rainfall_total"] is not None:
                if rain_total < dev_state["last_rainfall_total"]:
                    logger.info(f"Rainfall cumulative counter reset on {device.device_identifier}.")
                elif rain_interval is None:
                    rain_interval = round(rain_total - dev_state["last_rainfall_total"], 2)
            dev_state["last_rainfall_total"] = rain_total

        # 8. Sensor Quality Assessment (Valid, Suspect, Invalid, Missing)
        quality_flags = self._evaluate_quality_flags(
            dev_state,
            temp_c,
            hum_pct,
            press_hpa,
            wind_mps,
            rain_wetness if rain_wetness is not None else rain_interval
        )

        # 9. Store Telemetry Message
        received_time = utc_now()
        telemetry_msg = TelemetryMessage(
            device_id=device.id,
            station_id=device.station_id,
            message_id=telemetry.message_id,
            sequence=telemetry.sequence,
            boot_id=telemetry.boot_id,
            device_timestamp=telemetry.timestamp,
            received_at=received_time,
            uptime_seconds=telemetry.uptime_seconds,
            firmware_version=telemetry.firmware_version,
            raw_payload=json.dumps(payload_data, default=str),
            is_simulated=is_simulated
        )
        db.add(telemetry_msg)
        db.flush()

        # 10. Store Measurement
        meas = Measurement(
            telemetry_id=telemetry_msg.id,
            device_id=device.id,
            station_id=device.station_id,
            timestamp=telemetry.timestamp,
            temperature_c=temp_c,
            humidity_pct=hum_pct,
            pressure_hpa=press_hpa,
            wind_speed_mps=wind_mps,
            wind_gust_mps=wind_gust,
            rainfall_interval_mm=rain_interval,
            rainfall_total_mm=rain_total,
            rain_rate_mmh=rain_rate,
            rain_wetness_pct=rain_wetness,
            quality_flags=json.dumps(quality_flags),
            is_simulated=is_simulated
        )
        db.add(meas)

        # 11. Update Device Health & Freshness
        device.status = "ONLINE"
        device.last_seen_at = received_time
        device.last_telemetry_at = received_time
        if telemetry.health:
            if telemetry.health.battery_voltage_v is not None:
                device.battery_voltage = telemetry.health.battery_voltage_v
            if telemetry.health.battery_percent is not None:
                device.battery_percent = telemetry.health.battery_percent
            if telemetry.health.wifi_rssi_dbm is not None:
                device.wifi_rssi = telemetry.health.wifi_rssi_dbm

        db.commit()

        # 12. Evaluate Event Detection Rules
        incidents = event_engine.evaluate_measurement(db, meas, device)

        # 13. Broadcast via WebSocket
        await ws_manager.broadcast({
            "type": "TELEMETRY_UPDATE",
            "station_id": device.station_id,
            "device_id": device.id,
            "device_identifier": device.device_identifier,
            "timestamp": telemetry.timestamp.isoformat(),
            "measurements": {
                "temperature_c": temp_c,
                "humidity_pct": hum_pct,
                "pressure_hpa": press_hpa,
                "wind_speed_mps": wind_mps,
                "wind_gust_mps": wind_gust,
                "rainfall_interval_mm": rain_interval,
                "rainfall_total_mm": rain_total,
                "rain_rate_mmh": rain_rate,
                "rain_wetness_pct": rain_wetness
            },
            "quality_flags": quality_flags,
            "is_simulated": is_simulated,
            "health": {
                "battery_voltage_v": device.battery_voltage,
                "battery_percent": device.battery_percent,
                "wifi_rssi_dbm": device.wifi_rssi
            },
            "new_incidents_count": len(incidents)
        })

        return True, "Telemetry ingested successfully", meas

    def _evaluate_quality_flags(
        self,
        dev_state: Dict[str, Any],
        temp: Optional[float],
        hum: Optional[float],
        press: Optional[float],
        wind: Optional[float],
        rain: Optional[float]
    ) -> Dict[str, str]:
        flags = {}

        # Temperature checks (-40 to 65 °C realistic physical ambient limits)
        if temp is None:
            flags["temp"] = "MISSING"
        elif temp < -40.0 or temp > 65.0:
            flags["temp"] = "INVALID"
        else:
            # Check for sudden physical impossibility jump (> 10°C in one 10s interval)
            last_t = dev_state["last_values"].get("temp")
            if last_t is not None and abs(temp - last_t) > 10.0:
                flags["temp"] = "SUSPECT"
            else:
                flags["temp"] = "VALID"
            dev_state["last_values"]["temp"] = temp

        # Humidity checks (0 to 100%)
        if hum is None:
            flags["hum"] = "MISSING"
        elif hum < 0.0 or hum > 100.0:
            flags["hum"] = "INVALID"
        else:
            flags["hum"] = "VALID"

        # Pressure checks (870 to 1085 hPa terrestrial bounds)
        if press is None:
            flags["press"] = "MISSING"
        elif press < 870.0 or press > 1085.0:
            flags["press"] = "INVALID"
        else:
            flags["press"] = "VALID"

        # Wind speed checks (0 to 75 m/s)
        if wind is None:
            flags["wind"] = "MISSING"
        elif wind < 0.0 or wind > 75.0:
            flags["wind"] = "INVALID"
        else:
            flags["wind"] = "VALID"

        # Rain interval checks (0 to 100 mm in single interval)
        if rain is None:
            flags["rain"] = "MISSING"
        elif rain < 0.0 or rain > 150.0:
            flags["rain"] = "INVALID"
        else:
            flags["rain"] = "VALID"

        return flags

ingestion_service = IngestionService()
