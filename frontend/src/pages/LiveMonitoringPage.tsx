import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Radio, Wifi, WifiOff, Thermometer, Droplets,
  Gauge, Wind, CloudRain, Battery, Zap, AlertCircle, Clock,
  Calendar, Download, Database
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { QualityPill } from '../components/common/QualityPill';

export const LiveMonitoringPage: React.FC = () => {
  const { selectedStationId, wsConnected, latestEvent, recentEvents } = useSimulator();
  const [historyRange, setHistoryRange] = useState<'today' | '7d' | '30d'>('today');
  const [historyMetric, setHistoryMetric] = useState<'temperature_c' | 'humidity_pct' | 'pressure_hpa' | 'wind_speed_mps' | 'rainfall_total_mm'>('temperature_c');

  // Query latest snapshot
  const { data: latestSnapshot } = useQuery({
    queryKey: ['telemetry-latest', selectedStationId],
    queryFn: () => api.getLatestTelemetry(selectedStationId || undefined),
    refetchInterval: 3000,
  });

  const { data: devices } = useQuery({
    queryKey: ['station-devices', selectedStationId],
    queryFn: () => api.getDevices(selectedStationId || undefined),
    refetchInterval: 5000,
  });

  // Query historical records for the embedded history section
  const queryLimit = historyRange === 'today' ? 48 : historyRange === '7d' ? 168 : 300;
  const { data: historicalRecords, isLoading: historyLoading } = useQuery({
    queryKey: ['live-page-history', selectedStationId, queryLimit],
    queryFn: () => api.queryTelemetry({ station_id: selectedStationId || undefined, limit: queryLimit }),
    refetchInterval: 15000,
  });

  const primaryDevice = devices && devices.length > 0 ? devices[0] : null;

  // Compute live data age
  const [dataAgeSeconds, setDataAgeSeconds] = useState<number>(0);

  useEffect(() => {
    const updateAge = () => {
      const ts = latestEvent?.timestamp || latestSnapshot?.timestamp;
      if (ts) {
        const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
        setDataAgeSeconds(diff);
      }
    };
    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [latestEvent, latestSnapshot]);

  // Merge latest WebSocket event or REST snapshot
  const currentTemp = latestEvent?.measurements?.temperature_c ?? latestSnapshot?.temperature_c;
  const currentHum = latestEvent?.measurements?.humidity_pct ?? latestSnapshot?.humidity_pct;
  const currentPress = latestEvent?.measurements?.pressure_hpa ?? latestSnapshot?.pressure_hpa;
  const currentWind = latestEvent?.measurements?.wind_speed_mps ?? latestSnapshot?.wind_speed_mps;
  const currentRain = latestEvent?.measurements?.rain_wetness_pct ?? latestSnapshot?.rain_wetness_pct;
  const currentRainRate = latestEvent?.measurements?.rain_rate_mmh ?? latestSnapshot?.rain_rate_mmh;

  const qualityFlags = latestEvent?.quality_flags || (latestSnapshot?.quality_flags ? JSON.parse(latestSnapshot.quality_flags) : {});
  const isLive = wsConnected && dataAgeSeconds < 45;

  const metricMeta = {
    temperature_c: { label: 'Temperature', unit: '°C', color: '#0284C7' },
    humidity_pct: { label: 'Humidity', unit: '%', color: '#6366F1' },
    pressure_hpa: { label: 'Pressure', unit: 'hPa', color: '#10B981' },
    wind_speed_mps: { label: 'Wind Speed', unit: 'm/s', color: '#06B6D4' },
    rainfall_total_mm: { label: 'Rain Total', unit: 'mm', color: '#3B82F6' },
  }[historyMetric];

  const historyChartData = (historicalRecords || [])
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: r[historyMetric] ?? 0,
    }));

  const handleExportCSV = () => {
    if (!historicalRecords || historicalRecords.length === 0) return;
    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)', 'Wind Speed (m/s)', 'Rainfall Total (mm)', 'Rain Rate (mm/h)', 'Quality'];
    const rows = historicalRecords.map((r) => [
      r.timestamp,
      r.temperature_c ?? '',
      r.humidity_pct ?? '',
      r.pressure_hpa ?? '',
      r.wind_speed_mps ?? '',
      r.rainfall_total_mm ?? '',
      r.rain_rate_mmh ?? '',
      `"${r.quality_flags || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `microclimate_telemetry_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Live Stream Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight">
              Live Monitoring & History
            </h1>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" /> LIVE STREAM
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-mono text-xs font-medium whitespace-nowrap">
                <Clock className="w-3 h-3 text-amber-600 shrink-0" /> STANDBY
              </span>
            )}
          </div>
          <p className="text-xs text-navy-500 mt-1">
            Real-time telemetry streaming from the MICROMATE ESP32 hardware node with historical archives.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs shrink-0 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-surface-border shadow-xs text-navy-700 whitespace-nowrap">
            <span className="text-navy-400">Latency:</span>
            <span className={dataAgeSeconds < 15 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
              {dataAgeSeconds}s
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-surface-border shadow-xs text-navy-700 whitespace-nowrap">
            <span className="text-navy-400">Channel:</span>
            <span className="text-primary-700 font-bold">{wsConnected ? 'WebSocket' : 'HTTP Poll'}</span>
          </div>
        </div>
      </div>

      {/* Device Connection Summary Card */}
      {primaryDevice && (
        <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-600">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-navy-900 text-sm md:text-base">
                    {primaryDevice.name}
                  </h3>
                  <span className="text-xs font-mono text-navy-600 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-semibold">
                    {primaryDevice.device_identifier}
                  </span>
                </div>
                <div className="text-xs text-navy-500 font-mono mt-0.5">
                  Firmware: v{primaryDevice.firmware_version} • Hardware: {primaryDevice.hardware_profile}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-navy-400 block text-[10px] uppercase font-bold">Node Status</span>
                <StatusBadge status={primaryDevice.status} size="sm" />
              </div>

              {primaryDevice.battery_voltage !== null && primaryDevice.battery_voltage !== undefined && (
                <div>
                  <span className="text-navy-400 block text-[10px] uppercase font-bold">Battery</span>
                  <span className="text-navy-800 font-bold flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5 text-emerald-600" />
                    {primaryDevice.battery_voltage.toFixed(2)} V
                  </span>
                </div>
              )}

              {primaryDevice.wifi_rssi !== null && primaryDevice.wifi_rssi !== undefined && (
                <div>
                  <span className="text-navy-400 block text-[10px] uppercase font-bold">Wi-Fi Signal</span>
                  <span className="text-navy-800 font-bold flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-primary-600" />
                    {primaryDevice.wifi_rssi} dBm
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Variable Gauges Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Temp */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-sky-500" /> Temp</span>
            <QualityPill quality={qualityFlags.temp || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentTemp !== undefined && currentTemp !== null ? currentTemp.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">°C</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">BME280 Ambient</div>
        </div>

        {/* Humidity */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-indigo-500" /> Humidity</span>
            <QualityPill quality={qualityFlags.hum || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentHum !== undefined && currentHum !== null ? Math.round(currentHum) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">%</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">Relative Hum</div>
        </div>

        {/* Pressure */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-emerald-500" /> Pressure</span>
            <QualityPill quality={qualityFlags.press || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentPress !== undefined && currentPress !== null ? currentPress.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">hPa</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">Atmospheric Baro</div>
        </div>

        {/* Wind Speed */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-cyan-500" /> Wind</span>
            <QualityPill quality={qualityFlags.wind || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentWind !== undefined && currentWind !== null ? currentWind.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">m/s</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">
            {currentWind ? `${(currentWind * 3.6).toFixed(1)} km/h` : '-- km/h'}
          </div>
        </div>

        {/* Rainfall Total */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><CloudRain className="w-3.5 h-3.5 text-blue-500" /> Rain Wetness</span>
            <QualityPill quality={qualityFlags.rain || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentRain !== undefined && currentRain !== null ? currentRain.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">%</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">Rain Sensor Level</div>
        </div>

        {/* Rain Rate */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 text-center flex flex-col justify-between shadow-card">
          <div className="flex items-center justify-between text-xs text-navy-500 mb-2 font-medium">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Rain Rate</span>
            <QualityPill quality={qualityFlags.rain || 'VALID'} />
          </div>
          <div className="py-2">
            <span className="text-3xl font-extrabold font-mono text-navy-900 tracking-tight">
              {currentRainRate !== undefined && currentRainRate !== null ? currentRainRate.toFixed(1) : '--'}
            </span>
            <span className="text-xs text-navy-500 ml-1 font-bold">mm/h</span>
          </div>
          <div className="text-[10px] text-navy-400 font-mono">Instant Intensity</div>
        </div>
      </div>

      {/* Embedded Historical Sensor Trends Section */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-bold text-navy-900 tracking-tight flex items-center gap-2">
              <Database className="w-4 h-4 text-primary-600" />
              Sensor History & Trends
            </h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Historical records for {metricMeta.label} with flexible duration filters and clean CSV export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Selector */}
            <select
              value={historyMetric}
              onChange={(e) => setHistoryMetric(e.target.value as any)}
              className="bg-slate-50 text-navy-800 border border-surface-border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="temperature_c">Temperature (°C)</option>
              <option value="humidity_pct">Humidity (%)</option>
              <option value="pressure_hpa">Pressure (hPa)</option>
              <option value="wind_speed_mps">Wind Speed (m/s)</option>
              <option value="rainfall_total_mm">Rainfall (mm)</option>
            </select>

            {/* Time Filter */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-semibold">
              {(['today', '7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setHistoryRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition uppercase ${
                    historyRange === r
                      ? 'bg-white text-navy-900 font-bold shadow-xs'
                      : 'text-navy-500 hover:text-navy-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Export CSV Action */}
            <button
              onClick={handleExportCSV}
              disabled={!historicalRecords || historicalRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Historical Chart Canvas */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {historyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="liveHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricMeta.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={metricMeta.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit={metricMeta.unit} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                  formatter={(val: any) => [`${val} ${metricMeta.unit}`, metricMeta.label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={metricMeta.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#liveHistoryGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-navy-400">
              No historical records found for this period.
            </div>
          )}
        </div>
      </div>

      {/* Real-time Telemetry Event Feed Table */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-navy-900">
              Validated Telemetry Activity Log
            </h3>
            <p className="text-xs text-navy-500">
              Authenticated frames received via low-latency telemetry channel
            </p>
          </div>
          <span className="text-xs font-mono text-navy-500 font-semibold">
            {recentEvents.length} frames logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-border text-navy-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Node ID</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Hum (%)</th>
                <th className="py-2.5 px-3">Press (hPa)</th>
                <th className="py-2.5 px-3">Wind (m/s)</th>
                <th className="py-2.5 px-3">Rain (mm)</th>
                <th className="py-2.5 px-3">Rate (mm/h)</th>
                <th className="py-2.5 px-3">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {recentEvents.length > 0 ? (
                recentEvents.slice(0, 15).map((evt, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 text-navy-700 font-medium">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 text-primary-700 font-bold">{evt.device_identifier}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.temperature_c?.toFixed(1) ?? '--'}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.humidity_pct?.toFixed(0) ?? '--'}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.pressure_hpa?.toFixed(1) ?? '--'}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.wind_speed_mps?.toFixed(1) ?? '--'}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.rainfall_total_mm?.toFixed(1) ?? '--'}</td>
                    <td className="py-2.5 px-3 text-navy-900 font-semibold">{evt.measurements?.rain_rate_mmh?.toFixed(1) ?? '--'}</td>
                    <td className="py-2.5 px-3">
                      <QualityPill quality={evt.quality_flags?.temp || 'VALID'} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-navy-400 font-sans">
                    Awaiting live incoming telemetry stream... Verify the ESP32 ThingSpeak upload.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
