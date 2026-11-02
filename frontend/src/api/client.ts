import {
  DashboardSummary, Station, Device, Measurement, Incident,
  EventRule, SimulatorState, AnalyticsSummary, ReportJob, User
} from '../types';

const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

let authToken: string | null = localStorage.getItem('aeropulse_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('aeropulse_token', token);
  } else {
    localStorage.removeItem('aeropulse_token');
  }
};

export const getAuthToken = () => authToken;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Network request failed' }));
    throw new Error(errorData.detail || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<User>('/auth/me'),

  // Dashboard
  getDashboardSummary: (stationId?: string) =>
    request<DashboardSummary>(`/dashboard/summary${stationId ? `?station_id=${stationId}` : ''}`),

  // Stations
  getStations: () => request<Station[]>('/stations'),
  getStation: (id: string) => request<any>(`/stations/${id}`),
  createStation: (data: Partial<Station>) =>
    request<Station>('/stations', { method: 'POST', body: JSON.stringify(data) }),
  updateStation: (id: string, data: Partial<Station>) =>
    request<Station>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStation: (id: string) => request<any>(`/stations/${id}`, { method: 'DELETE' }),

  // Devices
  getDevices: (stationId?: string) =>
    request<Device[]>(`/devices${stationId ? `?station_id=${stationId}` : ''}`),
  getDevice: (id: string) => request<Device>(`/devices/${id}`),
  createDevice: (data: Partial<Device>) =>
    request<Device>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  getDeviceCredentials: (id: string) => request<any>(`/devices/${id}/credentials`),
  getDeviceSensors: (id: string) => request<any[]>(`/devices/${id}/sensors`),
  updateSensorConfig: (deviceId: string, sensorId: string, data: any) =>
    request<any>(`/devices/${deviceId}/sensors/${sensorId}`, { method: 'PUT', body: JSON.stringify(data) }),
  addCalibration: (deviceId: string, data: any) =>
    request<any>(`/devices/${deviceId}/calibrate`, { method: 'POST', body: JSON.stringify(data) }),

  // Telemetry
  getLatestTelemetry: (stationId?: string, deviceId?: string) => {
    const params = new URLSearchParams();
    if (stationId) params.append('station_id', stationId);
    if (deviceId) params.append('device_id', deviceId);
    return request<Measurement | null>(`/telemetry/latest?${params.toString()}`);
  },
  queryTelemetry: (params: { station_id?: string; device_id?: string; start_time?: string; end_time?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.station_id) q.append('station_id', params.station_id);
    if (params.device_id) q.append('device_id', params.device_id);
    if (params.start_time) q.append('start_time', params.start_time);
    if (params.end_time) q.append('end_time', params.end_time);
    if (params.limit) q.append('limit', params.limit.toString());
    return request<Measurement[]>(`/telemetry?${q.toString()}`);
  },

  // Analytics
  getAnalyticsSummary: (stationId?: string, periodHours: number = 24) =>
    request<AnalyticsSummary>(`/analytics/summary?period_hours=${periodHours}${stationId ? `&station_id=${stationId}` : ''}`),
  getTimeseries: (stationId?: string, rangePreset: string = '24h') =>
    request<any>(`/analytics/timeseries?range_preset=${rangePreset}${stationId ? `&station_id=${stationId}` : ''}`),

  // Events & Alerts
  getIncidents: (filters: { station_id?: string; status?: string; severity?: string; event_type?: string }) => {
    const q = new URLSearchParams();
    if (filters.station_id) q.append('station_id', filters.station_id);
    if (filters.status) q.append('status', filters.status);
    if (filters.severity) q.append('severity', filters.severity);
    if (filters.event_type) q.append('event_type', filters.event_type);
    return request<Incident[]>(`/events?${q.toString()}`);
  },
  getIncident: (id: string) => request<Incident>(`/events/${id}`),
  acknowledgeIncident: (id: string, acknowledgedBy: string) =>
    request<Incident>(`/events/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    }),
  resolveIncident: (id: string, notes?: string) =>
    request<Incident>(`/events/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution_notes: notes }),
    }),
  dismissIncident: (id: string, reason: string) =>
    request<Incident>(`/events/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ dismissal_reason: reason }),
    }),

  // Rules
  getRules: () => request<EventRule[]>('/rules'),
  createRule: (data: Partial<EventRule>) =>
    request<EventRule>('/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: Partial<EventRule>) =>
    request<EventRule>(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Simulator
  getSimulatorState: () => request<SimulatorState>('/simulator/state'),
  controlSimulator: (action: 'start' | 'pause' | 'resume' | 'stop' | 'reset', playback_speed?: number) =>
    request<SimulatorState>('/simulator/control', {
      method: 'POST',
      body: JSON.stringify({ action, playback_speed }),
    }),
  setSimulatorScenario: (scenario: string) =>
    request<SimulatorState>('/simulator/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),
  injectSimulatorAnomaly: (metric: string, value: number, durationSeconds: number = 60) =>
    request<any>('/simulator/inject', {
      method: 'POST',
      body: JSON.stringify({ metric, value, duration_seconds: durationSeconds }),
    }),
  injectDemoEvent: (metric?: string, value?: number) =>
    request<any>('/simulator/demo-inject', {
      method: 'POST',
      body: JSON.stringify({ metric, value }),
    }),

  // Notifications
  getNotifications: () => request<any[]>('/notifications'),
  getNotificationPreferences: () => request<any>('/notifications/preferences'),
  updateNotificationPreferences: (data: any) =>
    request<any>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  testNotification: (channel: string, message?: string) =>
    request<any>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ channel, message }),
    }),

  // Reports
  getReports: () => request<ReportJob[]>('/reports'),
  generateReport: (data: { station_id: string; report_type: string; format: string; date_from: string; date_to: string }) =>
    request<any>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request<any>('/settings'),
  getAuditLogs: () => request<any[]>('/settings/audit-logs'),

  // ThingSpeak Cloud Integration (Option A)
  getThingSpeakConfig: () => request<any>('/thingspeak/config'),
  updateThingSpeakConfig: (data: any) =>
    request<any>('/thingspeak/config', { method: 'PUT', body: JSON.stringify(data) }),
  testThingSpeakConnection: (data: { channel_id: string; read_api_key?: string }) =>
    request<any>('/thingspeak/test', { method: 'POST', body: JSON.stringify(data) }),
  syncThingSpeak: () => request<any>('/thingspeak/sync', { method: 'POST' }),

  // MicroMate Weather Assistant
  getMicroMateStatus: (stationId?: string) =>
    request<any>(`/micromate/status${stationId ? `?station_id=${stationId}` : ''}`),
  chatWithMicroMate: (data: { prompt: string; language: string; station_id?: string }) =>
    request<any>('/micromate/chat', { method: 'POST', body: JSON.stringify(data) }),
};

export const apiClient = api;
