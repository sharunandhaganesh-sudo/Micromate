from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Index
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="viewer", nullable=False)  # admin, operator, viewer
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    preferences = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")


class Station(Base):
    __tablename__ = "stations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    location_name = Column(String(150), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), default="UTC", nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    devices = relationship("Device", back_populates="station", cascade="all, delete-orphan")
    telemetry_messages = relationship("TelemetryMessage", back_populates="station")
    measurements = relationship("Measurement", back_populates="station")
    incidents = relationship("Incident", back_populates="station")


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    device_identifier = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "node01", "esp32-micro-01"
    name = Column(String(100), nullable=False)
    hardware_profile = Column(String(100), default="ESP32-WROOM-32D / BME280 / Anemometer / TippingBucket")
    firmware_version = Column(String(50), default="1.0.0")
    is_demo = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="NEVER_CONNECTED", nullable=False)  # ONLINE, STALE, OFFLINE, NEVER_CONNECTED
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_telemetry_at = Column(DateTime(timezone=True), nullable=True)
    battery_voltage = Column(Float, nullable=True)
    battery_percent = Column(Float, nullable=True)
    wifi_rssi = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    station = relationship("Station", back_populates="devices")
    credentials = relationship("DeviceCredential", back_populates="device", cascade="all, delete-orphan")
    sensors = relationship("SensorConfiguration", back_populates="device", cascade="all, delete-orphan")
    calibrations = relationship("CalibrationRecord", back_populates="device", cascade="all, delete-orphan")
    telemetry_messages = relationship("TelemetryMessage", back_populates="device")
    measurements = relationship("Measurement", back_populates="device")
    incidents = relationship("Incident", back_populates="device")


class DeviceCredential(Base):
    __tablename__ = "device_credentials"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(100), unique=True, nullable=False, index=True)
    mqtt_username = Column(String(50), nullable=True)
    mqtt_password_hash = Column(String(255), nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    device = relationship("Device", back_populates="credentials")


class SensorConfiguration(Base):
    __tablename__ = "sensor_configurations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    sensor_type = Column(String(50), nullable=False)  # BME280_TEMP, BME280_HUM, BME280_PRESS, ANEMOMETER, RAIN_GAUGE, BATTERY
    pin_or_bus = Column(String(50), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    calibration_factor = Column(Float, default=1.0, nullable=False)
    calibration_offset = Column(Float, default=0.0, nullable=False)
    sampling_interval_s = Column(Integer, default=10, nullable=False)

    device = relationship("Device", back_populates="sensors")


class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    sensor_type = Column(String(50), nullable=False)
    calibration_factor = Column(Float, nullable=False)
    calibration_offset = Column(Float, nullable=False)
    performed_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    device = relationship("Device", back_populates="calibrations")


class TelemetryMessage(Base):
    __tablename__ = "telemetry_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    message_id = Column(String(100), nullable=False, index=True)
    sequence = Column(Integer, nullable=True)
    boot_id = Column(String(100), nullable=True)
    device_timestamp = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    uptime_seconds = Column(Integer, nullable=True)
    firmware_version = Column(String(50), nullable=True)
    raw_payload = Column(Text, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)

    device = relationship("Device", back_populates="telemetry_messages")
    station = relationship("Station", back_populates="telemetry_messages")
    measurements = relationship("Measurement", back_populates="telemetry", cascade="all, delete-orphan")


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    telemetry_id = Column(String(36), ForeignKey("telemetry_messages.id", ondelete="CASCADE"), nullable=True)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Core physical parameters
    temperature_c = Column(Float, nullable=True)
    humidity_pct = Column(Float, nullable=True)
    pressure_hpa = Column(Float, nullable=True)
    wind_speed_mps = Column(Float, nullable=True)
    wind_gust_mps = Column(Float, nullable=True)
    rainfall_interval_mm = Column(Float, nullable=True)
    rainfall_total_mm = Column(Float, nullable=True)
    rain_rate_mmh = Column(Float, nullable=True)
    rain_wetness_pct = Column(Float, nullable=True)
    
    # Sensor quality status JSON
    # e.g., '{"temp": "VALID", "hum": "VALID", "press": "VALID", "wind": "VALID", "rain": "VALID"}'
    quality_flags = Column(Text, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)

    telemetry = relationship("TelemetryMessage", back_populates="measurements")
    device = relationship("Device", back_populates="measurements")
    station = relationship("Station", back_populates="measurements")

    __table_args__ = (
        Index("idx_measurements_station_time", "station_id", "timestamp"),
        Index("idx_measurements_device_time", "device_id", "timestamp"),
    )


class EventRule(Base):
    __tablename__ = "event_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    metric = Column(String(50), nullable=False)  # temperature_c, humidity_pct, pressure_hpa, wind_speed_mps, wind_gust_mps, rain_rate_mmh, rainfall_total_mm, pressure_drop_3h, device_offline, sensor_health
    operator = Column(String(10), nullable=False)  # >, >=, <, <=, ==, DROP_GREATER_THAN
    threshold = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    window_seconds = Column(Integer, default=60, nullable=False)
    persistence_seconds = Column(Integer, default=0, nullable=False)
    recovery_threshold = Column(Float, nullable=True)
    severity = Column(String(20), default="warning", nullable=False)  # advisory, warning, critical
    cooldown_seconds = Column(Integer, default=300, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    applicable_station_id = Column(String(36), nullable=True)  # null = global
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True, index=True)
    device_id = Column(String(36), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_id = Column(String(36), ForeignKey("event_rules.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False, index=True)  # HEAVY_RAIN, HIGH_RAIN_RATE, STRONG_WIND, HIGH_TEMPERATURE, RAPID_PRESSURE_DECLINE, SENSOR_MALFUNCTION, DEVICE_OFFLINE, LOW_BATTERY
    severity = Column(String(20), nullable=False)  # advisory, warning, critical
    status = Column(String(20), default="ACTIVE", nullable=False, index=True)  # ACTIVE, ACKNOWLEDGED, RESOLVED, DISMISSED
    start_time = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_occurrence = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    triggering_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    evidence_summary = Column(Text, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)
    resolution_notes = Column(Text, nullable=True)
    dismissal_reason = Column(Text, nullable=True)

    station = relationship("Station", back_populates="incidents")
    device = relationship("Device", back_populates="incidents")
    rule = relationship("EventRule")
    evidences = relationship("IncidentEvidence", back_populates="incident", cascade="all, delete-orphan")
    notifications = relationship("AlertNotification", back_populates="incident", cascade="all, delete-orphan")


class IncidentEvidence(Base):
    __tablename__ = "incident_evidences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    metric_name = Column(String(50), nullable=False)
    observed_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    note = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="evidences")


class AlertNotification(Base):
    __tablename__ = "alert_notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(20), nullable=False)  # IN_APP, EMAIL, TELEGRAM
    destination = Column(String(150), nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, SENT, FAILED
    idempotency_key = Column(String(100), unique=True, nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="notifications")


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    email_enabled = Column(Boolean, default=True, nullable=False)
    telegram_enabled = Column(Boolean, default=False, nullable=False)
    in_app_enabled = Column(Boolean, default=True, nullable=False)
    min_severity = Column(String(20), default="advisory", nullable=False)
    telegram_chat_id = Column(String(50), nullable=True)
    notification_email = Column(String(100), nullable=True)

    user = relationship("User", back_populates="preferences")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="audit_logs")


class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_name = Column(String(100), nullable=False)
    scenario = Column(String(50), default="normal_weather", nullable=False)  # normal_weather, temperature_spike, heavy_rain, strong_wind, rapid_pressure_drop, sensor_disconnect, wifi_outage, battery_decline
    is_active = Column(Boolean, default=False, nullable=False)
    playback_speed = Column(Float, default=1.0, nullable=False)  # 1x, 2x, 5x, 10x
    current_step = Column(Integer, default=0, nullable=False)
    total_steps = Column(Integer, default=1000, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class ReportJob(Base):
    __tablename__ = "report_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)  # daily_summary, weekly_summary, monthly_monitoring, event_summary, uptime_report, data_quality, sensor_calibration
    format = Column(String(10), default="json", nullable=False)  # json, csv, pdf
    date_from = Column(DateTime(timezone=True), nullable=False)
    date_to = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="COMPLETED", nullable=False)
    summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class ThingSpeakChannel(Base):
    __tablename__ = "thingspeak_channels"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    channel_id = Column(String(50), nullable=False, index=True)
    channel_name = Column(String(100), nullable=True)
    read_api_key = Column(String(100), nullable=True)
    write_api_key = Column(String(100), nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    # JSON field mapping, e.g. {"field1": "temperature_c", "field2": "humidity_pct", ...}
    field_mapping = Column(Text, nullable=True)
    sync_interval_seconds = Column(Integer, default=20, nullable=False)
    last_entry_id = Column(Integer, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="IDLE", nullable=False)  # IDLE, SYNCING, ACTIVE, ERROR, UNCONFIGURED
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class MicroMateInteraction(Base):
    __tablename__ = "micromate_interactions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    emotion = Column(String(30), default="happy", nullable=False)
    language = Column(String(10), default="en", nullable=False)
    context_snapshot = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
