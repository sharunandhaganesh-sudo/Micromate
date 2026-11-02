import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download, Calendar, Filter, Database, TrendingUp, Search
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';
import { QualityPill } from '../components/common/QualityPill';

export const HistoricalDataPage: React.FC = () => {
  const { selectedStationId } = useSimulator();
  const [selectedMetric, setSelectedMetric] = useState<'temperature_c' | 'humidity_pct' | 'pressure_hpa' | 'wind_speed_mps' | 'rainfall_total_mm' | 'rain_rate_mmh'>('temperature_c');
  const [limit, setLimit] = useState<number>(200);

  const { data: records, isLoading } = useQuery({
    queryKey: ['historical-telemetry', selectedStationId, limit],
    queryFn: () => api.queryTelemetry({ station_id: selectedStationId || undefined, limit }),
  });

  const chartData = (records || [])
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: r[selectedMetric],
      quality: r.quality_flags,
    }));

  const metricMeta = {
    temperature_c: { label: 'Temperature', unit: '°C', stroke: '#38BDF8' },
    humidity_pct: { label: 'Humidity', unit: '%', stroke: '#818CF8' },
    pressure_hpa: { label: 'Pressure', unit: 'hPa', stroke: '#34D399' },
    wind_speed_mps: { label: 'Wind Speed', unit: 'm/s', stroke: '#22D3EE' },
    rainfall_total_mm: { label: 'Rain Total', unit: 'mm', stroke: '#60A5FA' },
    rain_rate_mmh: { label: 'Rain Rate', unit: 'mm/h', stroke: '#FBBF24' },
  }[selectedMetric];

  const handleExportCSV = () => {
    if (!records || records.length === 0) return;
    const headers = ['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Pressure (hPa)', 'Wind Speed (m/s)', 'Rainfall Total (mm)', 'Rain Rate (mm/h)', 'Quality Flags', 'Simulated'];
    const rows = records.map((r) => [
      r.timestamp,
      r.temperature_c ?? '',
      r.humidity_pct ?? '',
      r.pressure_hpa ?? '',
      r.wind_speed_mps ?? '',
      r.rainfall_total_mm ?? '',
      r.rain_rate_mmh ?? '',
      `"${r.quality_flags || ''}"`,
      r.is_simulated ? 'YES' : 'NO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `microclimate_historical_telemetry_${selectedStationId?.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border/60 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Historical Data Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Forensic analysis of physical sensor records, time-series drilldowns, and sanitized data export.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!records || records.length === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-medium text-xs transition self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Clean CSV</span>
        </button>
      </div>

      {/* Explorer Controls */}
      <div className="bg-surface rounded-2xl border border-surface-border p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium font-mono">Select Metric:</span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            className="bg-surface-elevated text-slate-200 border border-surface-border rounded-lg px-3 py-1.5 focus:border-primary-500 focus:outline-none"
          >
            <option value="temperature_c">Ambient Temperature (°C)</option>
            <option value="humidity_pct">Relative Humidity (%)</option>
            <option value="pressure_hpa">Atmospheric Pressure (hPa)</option>
            <option value="wind_speed_mps">Wind Speed (m/s)</option>
            <option value="rainfall_total_mm">Cumulative Rainfall (mm)</option>
            <option value="rain_rate_mmh">Rainfall Rate (mm/h)</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium font-mono">Row Limit:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="bg-surface-elevated text-slate-200 border border-surface-border rounded-lg px-3 py-1.5 focus:border-primary-500 focus:outline-none"
          >
            <option value={50}>50 samples</option>
            <option value={100}>100 samples</option>
            <option value={200}>200 samples</option>
            <option value={500}>500 samples</option>
          </select>
        </div>
      </div>

      {/* Interactive Time-series Chart */}
      <div className="bg-surface rounded-2xl border border-surface-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {metricMeta.label} ({metricMeta.unit}) Time-Series History
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {chartData.length} observations plotted
          </span>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
              <YAxis stroke={metricMeta.stroke} fontSize={10} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={`${metricMeta.label} (${metricMeta.unit})`}
                stroke={metricMeta.stroke}
                strokeWidth={2}
                dot={{ r: 1.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw Data Observation Records Table */}
      <div className="bg-surface rounded-2xl border border-surface-border p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
          <span>Raw Observation Log</span>
          <span className="text-xs text-slate-500 font-mono">Descending by UTC timestamp</span>
        </h3>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-surface border-b border-surface-border text-slate-400 text-[11px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Hum (%)</th>
                <th className="py-2.5 px-3">Press (hPa)</th>
                <th className="py-2.5 px-3">Wind (m/s)</th>
                <th className="py-2.5 px-3">Rain (mm)</th>
                <th className="py-2.5 px-3">Rate (mm/h)</th>
                <th className="py-2.5 px-3">Quality Flags</th>
                <th className="py-2.5 px-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40">
              {records && records.length > 0 ? (
                records.map((r) => {
                  let flags = {};
                  try {
                    flags = r.quality_flags ? JSON.parse(r.quality_flags) : {};
                  } catch (e) {}

                  return (
                    <tr key={r.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="py-2.5 px-3 text-slate-300">
                        {new Date(r.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{r.temperature_c?.toFixed(1) ?? '--'}</td>
                      <td className="py-2.5 px-3 text-slate-200">{r.humidity_pct?.toFixed(0) ?? '--'}</td>
                      <td className="py-2.5 px-3 text-slate-200">{r.pressure_hpa?.toFixed(1) ?? '--'}</td>
                      <td className="py-2.5 px-3 text-slate-200">{r.wind_speed_mps?.toFixed(1) ?? '--'}</td>
                      <td className="py-2.5 px-3 text-slate-200">{r.rainfall_total_mm?.toFixed(1) ?? '--'}</td>
                      <td className="py-2.5 px-3 text-slate-200">{r.rain_rate_mmh?.toFixed(1) ?? '--'}</td>
                      <td className="py-2.5 px-3">
                        <QualityPill quality={(flags as any).temp || 'VALID'} />
                      </td>
                      <td className="py-2.5 px-3">
                        {r.is_simulated ? (
                          <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1 py-0.5 rounded">
                            SIM
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1 py-0.5 rounded">
                            REAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-sans">
                    No historical telemetry records found.
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
