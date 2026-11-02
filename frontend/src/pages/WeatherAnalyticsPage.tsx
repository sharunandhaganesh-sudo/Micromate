import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart as RechartsLineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  TrendingUp, TrendingDown, Thermometer, Droplets, Gauge,
  Wind, CloudRain, ShieldCheck, Download, AlertCircle, Info
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';

export const WeatherAnalyticsPage: React.FC = () => {
  const { selectedStationId } = useSimulator();
  const [periodHours, setPeriodHours] = useState<number>(24);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['weather-analytics', selectedStationId, periodHours],
    queryFn: () => api.getAnalyticsSummary(selectedStationId || undefined, periodHours),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border/60 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Weather Intelligence & Microclimate Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Statistical aggregation, diurnal profiles, barometric tendencies, and rainfall accumulation bounds.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center bg-surface-elevated rounded-lg p-0.5 border border-surface-border text-xs font-mono">
          {[
            { label: '24 Hours', hours: 24 },
            { label: '7 Days', hours: 168 },
            { label: '30 Days', hours: 720 },
          ].map((tab) => (
            <button
              key={tab.hours}
              onClick={() => setPeriodHours(tab.hours)}
              className={`px-3 py-1.5 rounded-md transition ${
                periodHours === tab.hours
                  ? 'bg-primary-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scientific Integrity Note */}
      <div className="p-3 rounded-xl bg-surface-elevated/80 border border-primary-500/20 text-xs text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Observation Boundary Note:</strong> Rainfall totals are computed by strictly aggregating interval depth pulses rather than averaging non-linear cumulative counters. Barometric pressure changes are evaluated relative to the chosen interval. Statistical correlation does not indicate emergency forecasting.
        </div>
      </div>

      {/* Aggregated Statistical Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Temp Avg/Min/Max */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Temperature</span>
            <Thermometer className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {analytics?.temp_avg?.toFixed(1) ?? '--'} <span className="text-xs font-normal text-slate-400">°C</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Min: {analytics?.temp_min?.toFixed(1) ?? '--'}°</span>
            <span>Max: {analytics?.temp_max?.toFixed(1) ?? '--'}°</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rel. Humidity</span>
            <Droplets className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {analytics?.hum_avg?.toFixed(0) ?? '--'} <span className="text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Min: {analytics?.hum_min?.toFixed(0) ?? '--'}%</span>
            <span>Max: {analytics?.hum_max?.toFixed(0) ?? '--'}%</span>
          </div>
        </div>

        {/* Pressure & Change */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Pressure</span>
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {analytics?.press_avg?.toFixed(1) ?? '--'} <span className="text-xs font-normal text-slate-400">hPa</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Δ Period: <span className={analytics?.press_change && analytics.press_change < 0 ? 'text-rose-400' : 'text-slate-300'}>
              {analytics?.press_change !== null && analytics?.press_change !== undefined ? `${analytics.press_change > 0 ? '+' : ''}${analytics.press_change} hPa` : '--'}
            </span>
          </div>
        </div>

        {/* Wind Speed & Peak */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mean Wind</span>
            <Wind className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {analytics?.wind_avg?.toFixed(1) ?? '--'} <span className="text-xs font-normal text-slate-400">m/s</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Peak Gust: <span className="text-amber-400 font-bold">{analytics?.wind_max?.toFixed(1) ?? '--'} m/s</span>
          </div>
        </div>

        {/* Total Rainfall */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Rainfall</span>
            <CloudRain className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {analytics?.rain_total?.toFixed(1) ?? '0.0'} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Max Rate: {analytics?.rain_max_rate?.toFixed(1) ?? '0.0'} mm/h
          </div>
        </div>

        {/* Completeness */}
        <div className="bg-surface rounded-xl border border-surface-border p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Data Integrity</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {analytics?.data_completeness_pct ?? 0}%
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            Sampling continuity
          </div>
        </div>
      </div>

      {/* Hourly Diurnal Distribution Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Profile: Temp & Humidity */}
        <div className="bg-surface rounded-2xl border border-surface-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Hourly Mean Profile (Diurnal Cycle)
              </h3>
              <p className="text-xs text-slate-400">
                Inverse correlation of solar radiation heating and relative humidity
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={analytics?.hourly_profiles || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={9} tickLine={false} />
                <YAxis yAxisId="t" stroke="#38BDF8" fontSize={10} domain={['auto', 'auto']} />
                <YAxis yAxisId="h" orientation="right" stroke="#818CF8" fontSize={10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line yAxisId="t" type="monotone" dataKey="temp_avg" name="Mean Temp (°C)" stroke="#38BDF8" strokeWidth={2} dot={false} />
                <Line yAxisId="h" type="monotone" dataKey="hum_avg" name="Mean Humidity (%)" stroke="#818CF8" strokeWidth={2} dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Rainfall Depth Sum */}
        <div className="bg-surface rounded-2xl border border-surface-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Hourly Precipitation Depth Distribution
              </h3>
              <p className="text-xs text-slate-400">
                Summed rain gauge bucket tips per hourly boundary (mm)
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.hourly_profiles || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={9} tickLine={false} />
                <YAxis stroke="#60A5FA" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="rain_sum" name="Hourly Rain (mm)" fill="#60A5FA" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Mean Wind & Pressure Profile */}
        <div className="bg-surface rounded-2xl border border-surface-border p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Wind Velocity & Barometric Tendency Correlation
              </h3>
              <p className="text-xs text-slate-400">
                Investigating micro-scale gusts during barometric frontal fluctuations
              </p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={analytics?.hourly_profiles || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="hour" stroke="#64748B" fontSize={9} tickLine={false} />
                <YAxis yAxisId="w" stroke="#22D3EE" fontSize={10} />
                <YAxis yAxisId="p" orientation="right" stroke="#34D399" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line yAxisId="w" type="monotone" dataKey="wind_avg" name="Mean Wind (m/s)" stroke="#22D3EE" strokeWidth={2} dot={false} />
                <Line yAxisId="p" type="monotone" dataKey="press_avg" name="Mean Pressure (hPa)" stroke="#34D399" strokeWidth={2} dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
