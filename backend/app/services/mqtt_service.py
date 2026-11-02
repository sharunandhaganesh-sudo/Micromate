import json
import logging
import asyncio
from typing import Optional
import paho.mqtt.client as mqtt

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.services.ingestion import ingestion_service

logger = logging.getLogger(__name__)

class MQTTService:
    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.is_connected: bool = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        if not settings.MQTT_ENABLED:
            logger.info("MQTT_ENABLED is False. Skipping MQTT broker connection.")
            return

        try:
            # Paho MQTT 2.0+ client init
            self.client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id="aeropulse-backend-ingestor",
                clean_session=False
            )
            
            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

            if settings.MQTT_TLS_ENABLED:
                self.client.tls_set()

            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message

            # Connect non-blocking
            logger.info(f"Connecting to MQTT broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}...")
            self.client.connect_async(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, settings.MQTT_KEEPALIVE)
            self.client.loop_start()

        except Exception as e:
            logger.warning(
                f"Could not connect to external MQTT broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT} ({e}). "
                "MQTT ingestion will wait for broker availability; HTTP ingestion & simulator continue unaffected."
            )

    def stop(self):
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception as e:
                logger.error(f"Error disconnecting MQTT client: {e}")
            self.is_connected = False

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info("Successfully connected to MQTT Broker.")
            topic = f"{settings.MQTT_TOPIC_PREFIX}/devices/+/telemetry"
            client.subscribe(topic, qos=1)
            logger.info(f"Subscribed to topic: {topic}")
        else:
            self.is_connected = False
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        self.is_connected = False
        logger.warning(f"MQTT client disconnected (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)

            # Topic format: microclimate/v1/devices/{device_id}/telemetry
            parts = topic.split("/")
            if len(parts) >= 4 and parts[-1] == "telemetry":
                topic_device_id = parts[-2]
            else:
                topic_device_id = None

            if self._loop and self._loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self._process_message_async(data, topic_device_id),
                    self._loop
                )

        except json.JSONDecodeError:
            logger.warning(f"Received non-JSON payload on topic {msg.topic}")
        except Exception as e:
            logger.error(f"Error handling MQTT message: {e}", exc_info=True)

    async def _process_message_async(self, data: dict, topic_device_id: Optional[str]):
        db = SessionLocal()
        try:
            success, message, _ = await ingestion_service.ingest_telemetry(
                db=db,
                payload_data=data,
                is_simulated=False,
                authenticated_device_id=topic_device_id
            )
            if not success:
                logger.warning(f"MQTT telemetry ingestion failed: {message}")
        finally:
            db.close()

mqtt_service = MQTTService()
