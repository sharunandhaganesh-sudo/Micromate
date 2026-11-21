export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
}

export interface MetricSparkline {
  current: number | null;
  unit: string;
  last_updated: string | null;
  trend_delta?: number | null;
  quality: 'VALID' | 'SUSPECT' | 'INVALID' | 'MISSING' | 'STALE';
  sparkline: Array<{ time: string; val: number }>;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  description?: string;
  location_name: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  device_count?: number;
  active_incidents_count?: number;
  status?: string;
}

export interface Device {
  id: string;
  station_id?: string | null;
  device_identifier: string;
  name: string;
  hardware_profile: string;
  firmware_version: string;
  is_demo: boolean;
  status: 'ONLINE' | 'STALE' | 'OFFLINE' | 'NEVER_CONNECTED';
  last_seen_at?: string | null;
  last_telemetry_at?: string | null;
  battery_voltage?: number | null;
  battery_percent?: number | null;
  wifi_rssi?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface SensorConfig {
  id: string;
  device_id: string;
  sensor_type: string;
  pin_or_bus?: string;
  enabled: boolean;
  calibration_factor: number;
  calibration_offset: number;
  sampling_interval_s: number;
}

export interface Measurement {
  id: string;
  device_id: string;
  station_id?: string | null;
  timestamp: string;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  pressure_hpa?: number | null;
  wind_speed_mps?: number | null;
  wind_gust_mps?: number | null;
  rainfall_interval_mm?: number | null;
  rainfall_total_mm?: number | null;
  rain_rate_mmh?: number | null;
  rain_wetness_pct?: number | null;
  quality_flags?: string | null;
  is_simulated: boolean;
}

export interface DashboardSummary {
  active_stations: number;
  online_devices: number;
  offline_devices: number;
  stale_devices: number;
  active_incidents: number;
  station_condition: 'Normal' | 'Advisory' | 'Warning' | 'Critical' | 'Unknown';
  condition_details?: string | null;
  latest_freshness_seconds?: number | null;
  is_demo: boolean;
  metrics: {
    temperature: MetricSparkline;
    humidity: MetricSparkline;
    pressure: MetricSparkline;
    wind_speed: MetricSparkline;
    rainfall: MetricSparkline;
    rain_rate: MetricSparkline;
  };
  selected_station?: Station | null;
}

export interface IncidentEvidence {
  id: string;
  timestamp: string;
  metric_name: string;
  observed_value?: number | null;
  threshold_value?: number | null;
  note?: string | null;
}

export interface Incident {
  id: string;
  station_id?: string | null;
  device_id?: string | null;
  rule_id?: string | null;
  event_type: string;
  severity: 'advisory' | 'warning' | 'critical';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  start_time: string;
  last_occurrence: string;
  resolved_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  triggering_value?: number | null;
  threshold_value?: number | null;
  evidence_summary?: string | null;
  is_simulated: boolean;
  resolution_notes?: string | null;
  dismissal_reason?: string | null;
  evidences?: IncidentEvidence[];
}

export interface EventRule {
  id: string;
  rule_code: string;
  name: string;
  description?: string;
  metric: string;
  operator: string;
  threshold: number;
  unit: string;
  window_seconds: number;
  persistence_seconds: number;
  recovery_threshold?: number | null;
  severity: 'advisory' | 'warning' | 'critical';
  cooldown_seconds: number;
  is_enabled: boolean;
  applicable_station_id?: string | null;
  version: number;
  created_at: string;
}

export interface SimulatorState {
  is_active: boolean;
  scenario: string;
  playback_speed: number;
  current_step: number;
  total_steps: number;
  active_station_code: string;
  active_device_identifier: string;
  last_emitted_timestamp?: string | null;
}

export interface AnalyticsSummary {
  station_id: string;
  period_hours: number;
  temp_avg?: number | null;
  temp_min?: number | null;
  temp_max?: number | null;
  hum_avg?: number | null;
  hum_min?: number | null;
  hum_max?: number | null;
  press_avg?: number | null;
  press_change?: number | null;
  wind_avg?: number | null;
  wind_max?: number | null;
  rain_total: number;
  rain_max_rate: number;
  data_completeness_pct: number;
  hourly_profiles: Array<{
    hour: string;
    temp_avg?: number | null;
    hum_avg?: number | null;
    press_avg?: number | null;
    wind_avg?: number | null;
    rain_sum: number;
  }>;
}

export interface ReportJob {
  id: string;
  station_id: string;
  station_name?: string;
  report_type: string;
  format: string;
  date_from: string;
  date_to: string;
  status: string;
  created_at: string;
}

export interface ThingSpeakConfig {
  id: string;
  channel_id: string;
  channel_name?: string | null;
  name?: string | null;
  is_enabled: boolean;
  is_active?: boolean;
  sync_interval_seconds: number;
  has_read_api_key: boolean;
  read_api_key?: string;
  read_api_key_masked?: string | null;
  has_write_api_key: boolean;
  write_api_key?: string;
  write_api_key_masked?: string | null;
  field_mapping: Record<string, string>;
  last_entry_id?: number | null;
  last_synced_at?: string | null;
  status: 'IDLE' | 'SYNCING' | 'ACTIVE' | 'ERROR' | 'UNCONFIGURED';
  last_error?: string | null;
  station_id?: string | null;
}

export interface ThingSpeakTestResult {
  success: boolean;
  status: string;
  message: string;
  channel_id?: string;
  channel_name?: string;
  description?: string;
  total_entries?: number;
  last_entry_id?: number;
  last_entry?: Record<string, any>;
}

export interface MicroMateStatus {
  name: string;
  nickname: string;
  role: string;
  theme: string;
  emotion: 'happy' | 'excited' | 'thinking' | 'worried' | 'surprised' | 'sleepy' | 'sad' | 'in_alert';
  state: 'idle' | 'active' | 'alert' | 'offline';
  speech_cue: string;
  active_message?: string;
  thingspeak_sync_status?: string;
  cloud_source?: string;
  thingspeak_channel_id?: string;
  context: Record<string, any>;
}

export interface MicroMateChatResponse {
  prompt: string;
  response: string;
  emotion: 'happy' | 'excited' | 'thinking' | 'worried' | 'surprised' | 'sleepy' | 'sad' | 'in_alert';
  action: string;
  language: 'en' | 'ta' | 'hi';
  context: Record<string, any>;
  suggestions: string[];
}

