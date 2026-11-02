import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
import httpx
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.models.models import ThingSpeakChannel, Station, Device
from backend.app.services.ingestion import ingestion_service

logger = logging.getLogger(__name__)

DEFAULT_FIELD_MAPPING = {
    "field1": "temperature_c",
    "field2": "humidity_pct",
    "field3": "pressure_hpa",
    "field4": "wind_speed_mps",
    "field5": "rainfall_total_mm",
    "field6": "battery_voltage_v",
    "field7": "wifi_rssi_dbm",
    "field8": "rain_rate_mmh"
}

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def mask_api_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    if len(key) <= 4:
        return "****"
    return f"****{key[-4:]}"

class ThingSpeakService:
    def __init__(self):
        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._sync_lock = asyncio.Lock()

    def start(self, loop: asyncio.AbstractEventLoop):
        if not settings.THINGSPEAK_ENABLED:
            logger.info("ThingSpeak integration is disabled in settings.")
            return

        self.is_running = True
        try:
            if not self._task or self._task.done():
                self._task = loop.create_task(self._background_poll_loop())
                logger.info("ThingSpeak background poller started.")
        except Exception as e:
            logger.warning(f"Could not start ThingSpeak background task: {e}")

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            logger.info("ThingSpeak background poller stopped.")

    async def _background_poll_loop(self):
        while self.is_running:
            try:
                await self.sync_configured_channels()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in ThingSpeak background loop: {e}", exc_info=True)

            await asyncio.sleep(max(10, settings.THINGSPEAK_SYNC_INTERVAL_SECONDS))

    def get_or_create_primary_channel(self, db: Session) -> ThingSpeakChannel:
        """
        Retrieves primary ThingSpeak channel or creates one using env defaults.
        """
        ch = db.query(ThingSpeakChannel).first()
        if not ch:
            ch_id = settings.THINGSPEAK_CHANNEL_ID or "UNCONFIGURED"
            ch = ThingSpeakChannel(
                channel_id=ch_id,
                channel_name="Primary Weather Station Channel",
                read_api_key=settings.THINGSPEAK_READ_API_KEY,
                write_api_key=settings.THINGSPEAK_WRITE_API_KEY,
                is_enabled=bool(settings.THINGSPEAK_CHANNEL_ID and settings.THINGSPEAK_CHANNEL_ID != "UNCONFIGURED"),
                field_mapping=json.dumps(DEFAULT_FIELD_MAPPING),
                sync_interval_seconds=settings.THINGSPEAK_SYNC_INTERVAL_SECONDS,
                status="ACTIVE" if settings.THINGSPEAK_CHANNEL_ID else "UNCONFIGURED"
            )
            db.add(ch)
            db.commit()
            db.refresh(ch)
        return ch

    async def test_channel_connection(
        self,
        channel_id: str,
        read_api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tests connection to ThingSpeak channel API without mutating local state.
        """
        if not channel_id or channel_id == "UNCONFIGURED":
            return {
                "success": False,
                "status": "UNCONFIGURED",
                "message": "ThingSpeak Channel ID is not specified."
            }

        url = f"https://api.thingspeak.com/channels/{channel_id}/feeds.json"
        params = {"results": 1}
        if read_api_key:
            params["api_key"] = read_api_key

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)

            if res.status_code == 200:
                data = res.json()
                ch_info = data.get("channel", {})
                feeds = data.get("feeds", [])
                last_entry = feeds[0] if feeds else None

                return {
                    "success": True,
                    "status": "CONNECTED",
                    "channel_id": channel_id,
                    "channel_name": ch_info.get("name", "Unknown Channel"),
                    "description": ch_info.get("description", ""),
                    "field_names": {
                        f"field{i}": ch_info.get(f"field{i}")
                        for i in range(1, 9)
                        if ch_info.get(f"field{i}")
                    },
                    "total_entries": ch_info.get("last_entry_id", 0),
                    "last_entry": last_entry,
                    "message": f"Successfully connected to ThingSpeak Channel '{ch_info.get('name', channel_id)}'."
                }
            elif res.status_code == 404:
                return {
                    "success": False,
                    "status": "NOT_FOUND",
                    "message": f"ThingSpeak Channel ID {channel_id} not found. Verify the channel ID number."
                }
            elif res.status_code == 400 or res.status_code == 403:
                return {
                    "success": False,
                    "status": "FORBIDDEN",
                    "message": "Access denied by ThingSpeak. Please provide a valid Read API Key for this channel."
                }
            else:
                return {
                    "success": False,
                    "status": f"HTTP_{res.status_code}",
                    "message": f"ThingSpeak returned status {res.status_code}: {res.text}"
                }
        except Exception as e:
            logger.warning(f"ThingSpeak test connection error: {e}")
            return {
                "success": False,
                "status": "CONNECTION_ERROR",
                "message": f"Could not reach api.thingspeak.com: {str(e)}"
            }

    async def sync_channel(
        self,
        db: Session,
        channel: ThingSpeakChannel,
        results_count: int = 15
    ) -> Tuple[int, Optional[str]]:
        """
        Polls new entries from ThingSpeak and ingests them into measurements database.
        """
        if not channel.is_enabled or not channel.channel_id or channel.channel_id == "UNCONFIGURED":
            return 0, "Channel is unconfigured or disabled"

        url = f"https://api.thingspeak.com/channels/{channel.channel_id}/feeds.json"
        params: Dict[str, Any] = {"results": results_count}
        if channel.read_api_key:
            params["api_key"] = channel.read_api_key

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(url, params=params)

            if res.status_code != 200:
                err_msg = f"ThingSpeak error {res.status_code}: {res.text}"
                channel.status = "ERROR"
                channel.last_error = err_msg
                db.commit()
                return 0, err_msg

            data = res.json()
            feeds = data.get("feeds", [])
            ch_info = data.get("channel", {})

            if ch_info.get("name") and not channel.channel_name:
                channel.channel_name = ch_info.get("name")

            if not feeds:
                channel.status = "ACTIVE"
                channel.last_synced_at = utc_now()
                channel.last_error = None
                db.commit()
                return 0, "No feeds found on channel"

            # Parse field mapping
            mapping = DEFAULT_FIELD_MAPPING.copy()
            if channel.field_mapping:
                try:
                    custom_map = json.loads(channel.field_mapping)
                    mapping.update(custom_map)
                except Exception:
                    pass

            # Determine target station and device
            station = None
            if channel.station_id:
                station = db.query(Station).filter(Station.id == channel.station_id).first()
            if not station:
                station = db.query(Station).filter(Station.is_demo == False).first()
            if not station:
                # Create dedicated real ThingSpeak station
                station = Station(
                    code=f"STATION-TS-{channel.channel_id}",
                    name=ch_info.get("name") or f"ThingSpeak Station ({channel.channel_id})",
                    description=ch_info.get("description") or "Live microclimate station streaming via ThingSpeak Cloud IoT",
                    location_name="Field Telemetry Site",
                    is_demo=False,
                    timezone="UTC"
                )
                db.add(station)
                db.flush()
                channel.station_id = station.id

            device_identifier = f"esp32-ts-{channel.channel_id}"
            device = db.query(Device).filter(Device.device_identifier == device_identifier).first()
            if not device:
                device = Device(
                    station_id=station.id,
                    device_identifier=device_identifier,
                    name=f"ESP32 Node ({channel.channel_id})",
                    hardware_profile="ESP32 / BME280 / Anemometer / RainGauge via ThingSpeak",
                    firmware_version="1.0.0-ts",
                    is_demo=False,
                    status="ONLINE"
                )
                db.add(device)
                db.flush()

            ingested_count = 0

            # Process feeds in chronological order
            for feed in feeds:
                entry_id = feed.get("entry_id")
                if not entry_id:
                    continue

                # Skip if already ingested
                if channel.last_entry_id and entry_id <= channel.last_entry_id:
                    continue

                created_at_str = feed.get("created_at")
                try:
                    # ISO 8601 parsing from ThingSpeak format (e.g. 2026-11-02T06:20:00Z)
                    timestamp = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                except Exception:
                    timestamp = utc_now()

                def safe_float(val: Any) -> Optional[float]:
                    if val is None or val == "":
                        return None
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        return None

                def safe_int(val: Any) -> Optional[int]:
                    if val is None or val == "":
                        return None
                    try:
                        return int(float(val))
                    except (ValueError, TypeError):
                        return None

                measurements_dict: Dict[str, Any] = {}
                health_dict: Dict[str, Any] = {}

                # Map ThingSpeak field1..field8
                for field_key, metric_target in mapping.items():
                    raw_val = feed.get(field_key)
                    if raw_val is None or raw_val == "":
                        continue

                    if metric_target in [
                        "temperature_c", "humidity_pct", "pressure_hpa",
                        "wind_speed_mps", "wind_gust_mps", "rainfall_interval_mm",
                        "rainfall_total_mm", "rain_rate_mmh"
                    ]:
                        measurements_dict[metric_target] = safe_float(raw_val)
                    elif metric_target == "battery_voltage_v":
                        health_dict["battery_voltage_v"] = safe_float(raw_val)
                    elif metric_target == "battery_percent":
                        health_dict["battery_percent"] = safe_float(raw_val)
                    elif metric_target == "wifi_rssi_dbm":
                        health_dict["wifi_rssi_dbm"] = safe_int(raw_val)

                # Construct standardized payload
                payload = {
                    "schema_version": 1,
                    "message_id": f"ts-{channel.channel_id}-{entry_id}",
                    "device_id": device.device_identifier,
                    "sequence": entry_id,
                    "timestamp": timestamp.isoformat(),
                    "measurements": measurements_dict,
                    "health": health_dict
                }

                # Ingest through standard pipeline with is_simulated=False
                success, msg, _ = await ingestion_service.ingest_telemetry(
                    db=db,
                    payload_data=payload,
                    is_simulated=False,
                    authenticated_device_id=device.device_identifier
                )

                if success:
                    ingested_count += 1
                    channel.last_entry_id = entry_id

            channel.status = "ACTIVE"
            channel.last_synced_at = utc_now()
            channel.last_error = None
            db.commit()

            logger.info(f"ThingSpeak sync completed for channel {channel.channel_id}: {ingested_count} new entries ingested.")
            return ingested_count, None

        except Exception as e:
            err_msg = f"Failed to sync ThingSpeak channel {channel.channel_id}: {str(e)}"
            logger.error(err_msg, exc_info=True)
            channel.status = "ERROR"
            channel.last_error = str(e)
            db.commit()
            return 0, err_msg

    async def sync_configured_channels(self):
        async with self._sync_lock:
            db = SessionLocal()
            try:
                channels = db.query(ThingSpeakChannel).filter(
                    ThingSpeakChannel.is_enabled == True,
                    ThingSpeakChannel.channel_id != "UNCONFIGURED"
                ).all()

                for ch in channels:
                    await self.sync_channel(db, ch)
            finally:
                db.close()

thingspeak_service = ThingSpeakService()
