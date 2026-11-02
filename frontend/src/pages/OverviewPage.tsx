import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Radio,
  Wifi,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';
import { RealisticSensorCard } from '../components/sensors/RealisticSensorCard';

type ChartMetric = 'temperature' | 'humidity' | 'pressure' | 'wind' | 'rain';
type TimeWindow = 'today' | '7d' | '30d';

export const OverviewPage: React.FC = () => {
  const { selectedStationId } = useSimulator();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>('temperature');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('today');
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [injectSuccessMessage, setInjectSuccessMessage] = useState<string | null>(null);
  const [showInjectModal, setShowInjectModal] = useState<boolean>(false);
  const [injectMetric, setInjectMetric] = useState<string>('rain_rate_mmh');
  const [injectValue, setInjectValue] = useState<number>(45.0);

  // Metric presets for fast, realistic testing
  const metricConfigs: Record<string, { label: string; unit: string; defaultVal: number; min: number; max: number; step: number; hint: string }> = {
    rain_rate_mmh: { label: 'Rainfall Rate', unit: 'mm/h', defaultVal: 45.0, min: 0, max: 200, step: 1, hint: 'Extreme rain alert triggers > 30 mm/h' },
    temperature_c: { label: 'Temperature', unit: '°C', defaultVal: 42.0, min: -20, max: 60, step: 0.5, hint: 'High temperature advisory triggers > 38 °C' },
    wind_speed_mps: { label: 'Wind Speed', unit: 'm/s', defaultVal: 22.0, min: 0, max: 50, step: 0.5, hint: 'Severe wind warning triggers > 18 m/s' },
    pressure_hpa: { label: 'Atmospheric Pressure', unit: 'hPa', defaultVal: 992.0, min: 900, max: 1050, step: 0.5, hint: 'Low pressure squall warning triggers < 1000 hPa' },
    humidity_pct: { label: 'Relative Humidity', unit: '%', defaultVal: 95.0, min: 0, max: 100, step: 1, hint: 'High moisture / storm condition' },
  };

  // Query station dashboard summary
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['dashboard-summary', selectedStationId],
    queryFn: () => api.getDashboardSummary(selectedStationId || undefined),
    refetchInterval: 5000,
  });

  // Query timeseries data mapped to selected window
  const queryRangePreset = timeWindow === 'today' ? '24h' : timeWindow === '7d' ? '7d' : '30d';
  const { data: timeseriesData, isLoading: timeseriesLoading } = useQuery({
    queryKey: ['dashboard-timeseries', selectedStationId, queryRangePreset],
    queryFn: () => api.getTimeseries(selectedStationId || undefined, queryRangePreset as any),
    refetchInterval: 10000,
  });

  // Query recent alerts/events
  const { data: recentIncidents } = useQuery({
    queryKey: ['dashboard-incidents', selectedStationId],
    queryFn: () => api.getIncidents({ station_id: selectedStationId || undefined }),
    refetchInterval: 6000,
  });

  const m = summary?.metrics;
  const isDemo = summary?.is_demo ?? true;
  const activeIncidents = recentIncidents?.filter((i) => i.status === 'ACTIVE' || i.status === 'ACKNOWLEDGED') || [];
  const hasActiveWarning = activeIncidents.length > 0;
  const topIncident = activeIncidents[0];

  const handleInjectDemoEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsInjecting(true);
      setInjectSuccessMessage(null);
      const res = await api.injectDemoEvent(injectMetric, Number(injectValue));
      const cfg = metricConfigs[injectMetric];
      setInjectSuccessMessage(`Injected ${cfg?.label || injectMetric}: ${injectValue} ${cfg?.unit || ''}`);
      setShowInjectModal(false);
      refetchSummary();
      setTimeout(() => setInjectSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Failed to inject demo event', err);
    } finally {
      setIsInjecting(false);
    }
  };

  // Current overall status classification incorporating data freshness
  const freshnessSec = summary?.latest_freshness_seconds ?? 0;
  const isStale = freshnessSec > 120;
  const isOffline = freshnessSec > 300 || summary?.online_devices === 0;

  const overallCondition = isOffline
    ? 'Offline'
    : isStale
    ? 'Stale'
    : hasActiveWarning
    ? topIncident?.severity === 'critical'
      ? 'Critical'
      : 'Warning'
    : 'Normal';

  const conditionBgMap: Record<string, string> = {
    Normal: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    Warning: 'bg-orange-50 border-orange-200 text-orange-800',
    Critical: 'bg-rose-50 border-rose-200 text-rose-800',
    Stale: 'bg-amber-50 border-amber-200 text-amber-800',
    Offline: 'bg-slate-100 border-slate-300 text-slate-700',
  };

  const conditionDotMap: Record<string, string> = {
    Normal: 'bg-emerald-500',
    Warning: 'bg-orange-500',
    Critical: 'bg-rose-500',
    Stale: 'bg-amber-500',
    Offline: 'bg-slate-400',
  };

  // Metric status derivations
  const tempVal = m?.temperature?.current;
  const humVal = m?.humidity?.current;
  const presVal = m?.pressure?.current;
  const windVal = m?.wind_speed?.current;
  const rainVal = m?.rainfall?.current;

  const tempStatus =
    tempVal === undefined || tempVal === null
      ? 'unknown'
      : tempVal > 38
      ? 'critical'
      : tempVal > 32
      ? 'warning'
      : 'normal';

  const humStatus =
    humVal === undefined || humVal === null
      ? 'unknown'
      : humVal > 90 || humVal < 20
      ? 'warning'
      : 'normal';

  const presStatus =
    presVal === undefined || presVal === null
      ? 'unknown'
      : presVal < 990
      ? 'warning'
      : 'normal';

  const windStatus =
    windVal === undefined || windVal === null
      ? 'unknown'
      : windVal > 45
      ? 'critical'
      : windVal > 25
      ? 'warning'
      : 'normal';

  const rainStatus =
    rainVal === undefined || rainVal === null
      ? 'unknown'
      : rainVal > 25
      ? 'critical'
      : rainVal > 5
      ? 'warning'
      : 'normal';

  // Extract chart data key & labels
  const metricConfig: Record<
    ChartMetric,
    { label: string; unit: string; color: string; fillGradient: string; dataKey: string }
  > = {
    temperature: {
      label: 'Temperature',
      unit: '°C',
      color: '#0284C7',
      fillGradient: '#E0F2FE',
      dataKey: 'temperature',
    },
    humidity: {
      label: 'Humidity',
      unit: '%',
      color: '#0EA5E9',
      fillGradient: '#E0F2FE',
      dataKey: 'humidity',
    },
    pressure: {
      label: 'Atmospheric Pressure',
      unit: 'hPa',
      color: '#6366F1',
      fillGradient: '#EEF2FF',
      dataKey: 'pressure',
    },
    wind: {
      label: 'Wind Speed',
      unit: 'km/h',
      color: '#0D9488',
      fillGradient: '#CCFBF1',
      dataKey: 'wind_speed',
    },
    rain: {
      label: 'Rainfall',
      unit: 'mm',
      color: '#2563EB',
      fillGradient: '#DBEAFE',
      dataKey: 'rainfall',
    },
  };

  const activeMetricCfg = metricConfig[selectedMetric];

  // Normalize chart series data (timeseriesData is { points: [...] } or an array)
  const rawPoints = Array.isArray(timeseriesData)
    ? timeseriesData
    : Array.isArray(timeseriesData?.points)
    ? timeseriesData.points
    : [];

  const chartData = rawPoints.map((pt: any) => {
    let rawVal = 0;
    if (selectedMetric === 'temperature') rawVal = pt.temperature_c ?? pt.temperature ?? 0;
    else if (selectedMetric === 'humidity') rawVal = pt.humidity_pct ?? pt.humidity ?? 0;
    else if (selectedMetric === 'pressure') rawVal = pt.pressure_hpa ?? pt.pressure ?? 0;
    else if (selectedMetric === 'wind') rawVal = pt.wind_speed_mps ?? pt.wind_speed ?? 0;
    else if (selectedMetric === 'rain') rawVal = pt.rainfall_total_mm ?? pt.rainfall ?? 0;

    const timeStr = pt.time_label || (pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
    return {
      time: timeStr,
      value: typeof rawVal === 'number' ? Number(rawVal.toFixed(1)) : 0,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Overview Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-surface-border gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-navy-900">
              Microclimate Monitoring
            </h1>
            {isDemo ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold tracking-wide whitespace-nowrap">
                SIMULATED DEMO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold tracking-wide whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                REAL HARDWARE (THINGSPEAK)
              </span>
            )}
          </div>
          <p className="text-xs text-navy-500 mt-1">
            Real-time environmental observations, realistic 3D telemetry sensors, and verified weather status.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {summary?.latest_freshness_seconds !== undefined && summary.latest_freshness_seconds !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-surface-border text-xs text-navy-700 shadow-xs font-mono whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-primary-600 shrink-0" />
              <span>Data Freshness: {summary.latest_freshness_seconds}s</span>
            </div>
          )}
          <button
            onClick={() => refetchSummary()}
            title="Refresh latest telemetry"
            className="p-2 rounded-xl bg-white border border-surface-border hover:bg-slate-50 text-navy-600 hover:text-navy-900 shadow-xs transition cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Weather Status & Station Summary Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${conditionBgMap[overallCondition]} shadow-card`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white shadow-xs shrink-0 mt-0.5">
              {overallCondition === 'Normal' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-orange-600 animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-navy-900 tracking-tight">
                  Current Status: {overallCondition}
                </h2>
                <span className={`w-2 h-2 rounded-full ${conditionDotMap[overallCondition] || 'bg-slate-400'}`} />
              </div>
              <p className="text-xs text-navy-700 mt-1 leading-relaxed">
                {isOffline
                  ? 'Station hardware is currently offline or unreachable. Telemetry is paused.'
                  : isStale
                  ? 'Telemetry is stale. Station has not transmitted recent readings within the configured freshness window.'
                  : hasActiveWarning && topIncident
                  ? `${topIncident.event_type.replace(/_/g, ' ')}: ${topIncident.evidence_summary || 'Configured threshold exceeded.'}`
                  : 'All monitored microclimate parameters (temperature, humidity, atmospheric pressure, wind velocity, and rainfall) are within normal operational limits.'}
              </p>
              {topIncident && (
                <span className="text-[11px] font-mono text-navy-500 mt-1 block">
                  Detected at: {new Date(topIncident.start_time).toLocaleTimeString()} • State: Active
                </span>
              )}
            </div>
          </div>

          <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
            <span className="text-[11px] font-medium text-navy-500 block">Station Location</span>
            <span className="text-sm font-bold text-navy-900 block truncate max-w-[200px]">
              {summary?.selected_station?.name || 'Ridgecrest Observatory'}
            </span>
            <span className="text-[11px] font-mono text-primary-600 font-semibold block mt-0.5">
              ESP32 Station • Online
            </span>
          </div>
        </div>
      </div>

      {/* Demo Simulation Action Banner (Shown when station is in Demo Mode) */}
      {isDemo && (
        <div className="bg-gradient-to-r from-amber-50/90 to-amber-100/50 rounded-2xl border border-amber-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-bold text-navy-900">
                  Demonstration Weather Event
                </h3>
                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-mono font-bold uppercase whitespace-nowrap">
                  Single Action
                </span>
              </div>
              <p className="text-xs text-navy-600 mt-0.5">
                Simulate a deterministic extreme weather burst (Heavy Rain Alert &gt;30 mm/h) to verify incident detection and MicroMate response.
              </p>
              {injectSuccessMessage && (
                <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {injectSuccessMessage}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowInjectModal(true)}
            disabled={isInjecting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition shrink-0 cursor-pointer"
          >
            <Zap className={`w-4 h-4 text-amber-400 ${isInjecting ? 'animate-spin' : ''}`} />
            <span>{isInjecting ? 'Injecting Demonstration...' : 'Inject Event'}</span>
          </button>
        </div>
      )}

      {/* Sensor Selection & Value Input Modal */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 bg-navy-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900">
                    Inject Simulated Sensor Event
                  </h3>
                  <p className="text-[11px] text-navy-500">
                    Select a sensor parameter and set the value to test detection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInjectModal(false)}
                className="p-1 rounded-lg text-navy-400 hover:text-navy-900 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInjectDemoEvent} className="space-y-4 pt-4">
              {/* Metric Selector */}
              <div>
                <label className="block text-xs font-bold text-navy-800 mb-1.5">
                  Target Sensor Channel
                </label>
                <select
                  value={injectMetric}
                  onChange={(e) => {
                    const nextM = e.target.value;
                    setInjectMetric(nextM);
                    setInjectValue(metricConfigs[nextM]?.defaultVal ?? 0);
                  }}
                  className="w-full bg-slate-50 text-navy-900 border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  {Object.entries(metricConfigs).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label} ({cfg.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-navy-800">
                    Sensor Reading Value ({metricConfigs[injectMetric]?.unit})
                  </label>
                  <span className="text-[11px] font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md">
                    {injectValue} {metricConfigs[injectMetric]?.unit}
                  </span>
                </div>
                <input
                  type="number"
                  step={metricConfigs[injectMetric]?.step ?? 0.1}
                  min={metricConfigs[injectMetric]?.min ?? 0}
                  max={metricConfigs[injectMetric]?.max ?? 500}
                  value={injectValue}
                  onChange={(e) => setInjectValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 text-navy-900 font-mono font-bold text-sm border border-surface-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                />
                <p className="text-[11px] text-navy-500 mt-1.5 flex items-center gap-1">
                  <span className="font-semibold text-amber-700">Threshold Guide:</span> {metricConfigs[injectMetric]?.hint}
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-1">
                <span className="text-[10px] font-bold text-navy-400 uppercase tracking-wider block mb-1.5">
                  Quick Testing Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInjectMetric('rain_rate_mmh');
                      setInjectValue(48.0);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-navy-700 transition cursor-pointer"
                  >
                    ⛈️ Heavy Rain (48 mm/h)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInjectMetric('temperature_c');
                      setInjectValue(41.5);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-navy-700 transition cursor-pointer"
                  >
                    🔥 Heat Wave (41.5 °C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInjectMetric('wind_speed_mps');
                      setInjectValue(24.0);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-navy-700 transition cursor-pointer"
                  >
                    💨 Gale Wind (24 m/s)
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowInjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInjecting}
                  className="px-5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Zap className={`w-3.5 h-3.5 text-amber-400 ${isInjecting ? 'animate-spin' : ''}`} />
                  <span>{isInjecting ? 'Injecting...' : 'Confirm Injection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Five 3D Sensor Visual Cards (Main Highlight) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-navy-600 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary-500" />
            Live 3D Sensor Observations
          </h2>
          <span className="text-xs text-navy-500 font-mono">5 Telemetry Channels</span>
        </div>

        {/* Responsive Grid: 1 col on mobile, 2 col on tablet, 3-5 col on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
          {/* A. Temperature */}
          <RealisticSensorCard
            type="temperature"
            title="Temperature"
            value={tempVal}
            unit="°C"
            statusText={tempStatus === 'critical' ? 'High Temp' : tempStatus === 'warning' ? 'Warm' : 'Normal'}
            statusLevel={tempStatus}
            lastUpdated={m?.temperature?.last_updated ? new Date(m.temperature.last_updated).toLocaleTimeString() : undefined}
            secondaryLabel="Thermal Status"
            secondaryValue={tempVal && tempVal > 30 ? 'Warm Range' : 'Comfort Zone'}
          />

          {/* B. Humidity */}
          <RealisticSensorCard
            type="humidity"
            title="Relative Humidity"
            value={humVal}
            unit="%"
            statusText={humStatus === 'warning' ? 'Damp / Dry' : 'Normal'}
            statusLevel={humStatus}
            lastUpdated={m?.humidity?.last_updated ? new Date(m.humidity.last_updated).toLocaleTimeString() : undefined}
            secondaryLabel="Moisture"
            secondaryValue={humVal && humVal > 70 ? 'High Moisture' : 'Balanced'}
          />

          {/* C. Atmospheric Pressure */}
          <RealisticSensorCard
            type="pressure"
            title="Barometer Pressure"
            value={presVal}
            unit="hPa"
            statusText={presStatus === 'warning' ? 'Drop Detected' : 'Normal'}
            statusLevel={presStatus}
            lastUpdated={m?.pressure?.last_updated ? new Date(m.pressure.last_updated).toLocaleTimeString() : undefined}
            secondaryLabel="Barometric Trend"
            secondaryValue={presVal && presVal < 1005 ? 'Low (Storm Chance)' : 'Steady (Fair)'}
          />

          {/* D. Wind Speed */}
          <RealisticSensorCard
            type="wind"
            title="Wind Speed"
            value={windVal}
            unit="km/h"
            statusText={windStatus === 'critical' ? 'Gale Force' : windStatus === 'warning' ? 'Breezy' : 'Normal'}
            statusLevel={windStatus}
            lastUpdated={m?.wind_speed?.last_updated ? new Date(m.wind_speed.last_updated).toLocaleTimeString() : undefined}
            secondaryLabel="Anemometer"
            secondaryValue={windVal && windVal > 20 ? 'Moderate Breeze' : 'Calm / Gentle'}
          />

          {/* E. Rainfall */}
          <RealisticSensorCard
            type="rain"
            title="Precipitation"
            value={rainVal}
            unit="mm"
            statusText={rainStatus === 'critical' ? 'Heavy Downpour' : rainStatus === 'warning' ? 'Rain Shower' : 'No Rain'}
            statusLevel={rainStatus}
            lastUpdated={m?.rainfall?.last_updated ? new Date(m.rainfall.last_updated).toLocaleTimeString() : undefined}
            secondaryLabel="Gauge Collector"
            secondaryValue={rainVal && rainVal > 0 ? 'Accumulated Today' : 'Dry Surface'}
          />
        </div>
      </div>

      {/* 4. Simple Weather History Line Chart */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-bold text-navy-900 tracking-tight">
              Historical Observation Trends
            </h2>
            <p className="text-xs text-navy-500 mt-0.5">
              Clean continuous environmental telemetry curve for {activeMetricCfg.label}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Switcher Pills */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-medium">
              {(['temperature', 'humidity', 'pressure', 'wind', 'rain'] as ChartMetric[]).map((metric) => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition ${
                    selectedMetric === metric
                      ? 'bg-white text-navy-900 font-bold shadow-xs'
                      : 'text-navy-500 hover:text-navy-900'
                  }`}
                >
                  {metric}
                </button>
              ))}
            </div>

            {/* Time Window Switcher */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-medium">
              {(['today', '7d', '30d'] as TimeWindow[]).map((tw) => (
                <button
                  key={tw}
                  onClick={() => setTimeWindow(tw)}
                  className={`px-2.5 py-1.5 rounded-lg transition uppercase ${
                    timeWindow === tw
                      ? 'bg-white text-primary-700 font-bold shadow-xs'
                      : 'text-navy-500 hover:text-navy-900'
                  }`}
                >
                  {tw}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clean Line Chart Canvas */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricCfg.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={activeMetricCfg.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit={activeMetricCfg.unit}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                  formatter={(val: any) => [`${val} ${activeMetricCfg.unit}`, activeMetricCfg.label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={activeMetricCfg.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#chartGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-navy-400">
              No telemetry measurements recorded for this time window.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
