from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

# ----------------- Auth & User Schemas -----------------
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "operator"

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ----------------- Telemetry Contract v1 -----------------
class TelemetryMeasurements(BaseModel):
    temperature_c: Optional[float] = Field(None, ge=-50.0, le=80.0, description="Temperature in Celsius (-50 to 80°C)")
    humidity_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Relative humidity in % (0 to 100%)")
    pressure_hpa: Optional[float] = Field(None, ge=800.0, le=1200.0, description="Barometric atmospheric pressure in hPa (800 to 1200 hPa)")
    wind_speed_mps: Optional[float] = Field(None, ge=0.0, le=100.0, description="Wind speed in meters per second")
    wind_gust_mps: Optional[float] = Field(None, ge=0.0, le=120.0, description="Wind gust peak in meters per second")
    rainfall_interval_mm: Optional[float] = Field(None, ge=0.0, le=500.0, description="Rainfall depth in mm during sampling interval")
    rainfall_total_mm: Optional[float] = Field(None, ge=0.0, description="Cumulative gauge total in mm since device boot/reset")
    rain_rate_mmh: Optional[float] = Field(None, ge=0.0, le=500.0, description="Calculated rainfall intensity rate in mm/hour")

class TelemetryHealth(BaseModel):
    battery_voltage_v: Optional[float] = Field(None, ge=0.0, le=15.0)
    battery_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    wifi_rssi_dbm: Optional[int] = Field(None, ge=-120, le=0)

class TelemetryPayloadV1(BaseModel):
    schema_version: int = Field(1, ge=1, le=1)
    message_id: str = Field(..., min_length=1, max_length=100)
    device_id: str = Field(..., min_length=1, max_length=50)
    boot_id: Optional[str] = Field(None, max_length=100)
    sequence: Optional[int] = Field(None, ge=0)
    timestamp: datetime
    uptime_seconds: Optional[int] = Field(None, ge=0)
    firmware_version: Optional[str] = Field(None, max_length=50)
    measurements: TelemetryMeasurements
    health: Optional[TelemetryHealth] = Field(default_factory=TelemetryHealth)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_not_future(cls, v: datetime) -> datetime:
        # Allow small clock jitter (up to 5 minutes)
        # but avoid completely invalid future dates
        return v


# ----------------- Station Schemas -----------------
class StationBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    location_name: str = Field(..., min_length=2, max_length=150)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    timezone: str = "UTC"

class StationCreate(StationBase):
    is_demo: bool = False

class StationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None

class StationResponse(StationBase):
    id: str
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    device_count: Optional[int] = 0
    active_incidents_count: Optional[int] = 0
    status: Optional[str] = "Normal"

    class Config:
        from_attributes = True


# ----------------- Device Schemas -----------------
class DeviceBase(BaseModel):
    device_identifier: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    hardware_profile: Optional[str] = "ESP32-WROOM-32D / BME280 / Anemometer / TippingBucket"
    firmware_version: Optional[str] = "1.0.0"
    notes: Optional[str] = None

class DeviceCreate(DeviceBase):
    station_id: Optional[str] = None
    is_demo: bool = False

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    station_id: Optional[str] = None
    hardware_profile: Optional[str] = None
    firmware_version: Optional[str] = None
    notes: Optional[str] = None

class DeviceResponse(DeviceBase):
    id: str
    station_id: Optional[str]
    is_demo: bool
    status: str
    last_seen_at: Optional[datetime]
    last_telemetry_at: Optional[datetime]
    battery_voltage: Optional[float]
    battery_percent: Optional[float]
    wifi_rssi: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True

class DeviceCredentialResponse(BaseModel):
    id: str
    device_id: str
    token: str
    mqtt_username: Optional[str]
    mqtt_password: Optional[str]
    created_at: datetime


# ----------------- Sensor & Calibration Schemas -----------------
class SensorConfigResponse(BaseModel):
    id: str
    device_id: str
    sensor_type: str
    pin_or_bus: Optional[str]
    enabled: bool
    calibration_factor: float
    calibration_offset: float
    sampling_interval_s: int

    class Config:
        from_attributes = True

class SensorConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    calibration_factor: Optional[float] = None
    calibration_offset: Optional[float] = None
    sampling_interval_s: Optional[int] = None

class CalibrationRecordCreate(BaseModel):
    sensor_type: str
    calibration_factor: float
    calibration_offset: float
    performed_by: str
    notes: Optional[str] = None

class CalibrationRecordResponse(CalibrationRecordCreate):
    id: str
    device_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ----------------- Measurement & Telemetry Output Schemas -----------------
class MeasurementResponse(BaseModel):
    id: str
    device_id: str
    station_id: Optional[str]
    timestamp: datetime
    temperature_c: Optional[float]
    humidity_pct: Optional[float]
    pressure_hpa: Optional[float]
    wind_speed_mps: Optional[float]
    wind_gust_mps: Optional[float]
    rainfall_interval_mm: Optional[float]
    rainfall_total_mm: Optional[float]
    rain_rate_mmh: Optional[float]
    quality_flags: Optional[str]
    is_simulated: bool

    class Config:
        from_attributes = True


# ----------------- Event & Incident Schemas -----------------
class IncidentEvidenceResponse(BaseModel):
    id: str
    timestamp: datetime
    metric_name: str
    observed_value: Optional[float]
    threshold_value: Optional[float]
    note: Optional[str]

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: str
    station_id: Optional[str]
    device_id: Optional[str]
    rule_id: Optional[str]
    event_type: str
    severity: str
    status: str
    start_time: datetime
    last_occurrence: datetime
    resolved_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]
    triggering_value: Optional[float]
    threshold_value: Optional[float]
    evidence_summary: Optional[str]
    is_simulated: bool
    resolution_notes: Optional[str]
    dismissal_reason: Optional[str]
    evidences: List[IncidentEvidenceResponse] = []

    class Config:
        from_attributes = True

class IncidentAcknowledgeRequest(BaseModel):
    acknowledged_by: str

class IncidentResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None

class IncidentDismissRequest(BaseModel):
    dismissal_reason: str


# ----------------- Event Rules -----------------
class EventRuleBase(BaseModel):
    rule_code: str
    name: str
    description: Optional[str] = None
    metric: str
    operator: str
    threshold: float
    unit: str
    window_seconds: int = 60
    persistence_seconds: int = 0
    recovery_threshold: Optional[float] = None
    severity: str = "warning"
    cooldown_seconds: int = 300
    is_enabled: bool = True
    applicable_station_id: Optional[str] = None

class EventRuleCreate(EventRuleBase):
    pass

class EventRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    threshold: Optional[float] = None
    recovery_threshold: Optional[float] = None
    severity: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    is_enabled: Optional[bool] = None

class EventRuleResponse(EventRuleBase):
    id: str
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


# ----------------- Dashboard & Analytics Summary -----------------
class MetricSparkline(BaseModel):
    current: Optional[float]
    unit: str
    last_updated: Optional[datetime]
    trend_delta: Optional[float] = None  # compared to 1 hour / 24 hour prior
    quality: str = "VALID"  # VALID, SUSPECT, INVALID, MISSING, STALE
    sparkline: List[Dict[str, Any]] = []

class DashboardSummaryResponse(BaseModel):
    active_stations: int
    online_devices: int
    offline_devices: int
    stale_devices: int
    active_incidents: int
    station_condition: str  # Normal, Advisory, Warning, Critical, Unknown
    condition_details: Optional[str]
    latest_freshness_seconds: Optional[int]
    is_demo: bool
    metrics: Dict[str, MetricSparkline]
    selected_station: Optional[StationResponse] = None

class AnalyticsSummaryResponse(BaseModel):
    station_id: str
    period_hours: int
    temp_avg: Optional[float]
    temp_min: Optional[float]
    temp_max: Optional[float]
    hum_avg: Optional[float]
    hum_min: Optional[float]
    hum_max: Optional[float]
    press_avg: Optional[float]
    press_change: Optional[float]
    wind_avg: Optional[float]
    wind_max: Optional[float]
    rain_total: Optional[float]
    rain_max_rate: Optional[float]
    data_completeness_pct: float
    hourly_profiles: List[Dict[str, Any]] = []


# ----------------- Simulator Schemas -----------------
class SimulatorStateResponse(BaseModel):
    is_active: bool
    scenario: str
    playback_speed: float
    current_step: int
    total_steps: int
    active_station_code: str
    active_device_identifier: str
    last_emitted_timestamp: Optional[datetime]

class SimulatorControlRequest(BaseModel):
    action: str  # start, pause, resume, stop, reset
    playback_speed: Optional[float] = None

class SimulatorScenarioRequest(BaseModel):
    scenario: str  # normal_weather, temperature_spike, heavy_rain, strong_wind, rapid_pressure_drop, sensor_disconnect, wifi_outage, battery_decline

class SimulatorInjectRequest(BaseModel):
    metric: str
    value: float
    duration_seconds: Optional[int] = 60


# ----------------- Notifications & Reports -----------------
class NotificationPrefResponse(BaseModel):
    email_enabled: bool
    telegram_enabled: bool
    in_app_enabled: bool
    min_severity: str
    telegram_chat_id: Optional[str]
    notification_email: Optional[str]

class NotificationPrefUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    telegram_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    min_severity: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    notification_email: Optional[str] = None

class TestNotificationRequest(BaseModel):
    channel: str  # IN_APP, EMAIL, TELEGRAM
    message: Optional[str] = "AeroPulse test notification delivery check"

class ReportGenerateRequest(BaseModel):
    station_id: str
    report_type: str  # daily_summary, weekly_summary, monthly_monitoring, event_summary, uptime_report, data_quality, sensor_calibration
    format: str = "json"  # json, csv, pdf
    date_from: datetime
    date_to: datetime
