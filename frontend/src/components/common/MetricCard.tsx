import React from 'react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { QualityPill } from './QualityPill';
import { MetricSparkline } from '../../types';

interface MetricCardProps {
  title: string;
  metric: MetricSparkline;
  icon: React.ReactNode;
  colorHex?: string;
  description?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  metric,
  icon,
  colorHex = '#38BDF8',
  description,
}) => {
  const { current, unit, last_updated, trend_delta, quality, sparkline } = metric;

  const formatValue = (v: number | null) => {
    if (v === null || v === undefined) return '--';
    if (unit === '°C' || unit === 'm/s' || unit === 'mm' || unit === 'mm/h') {
      return v.toFixed(1);
    }
    if (unit === 'hPa') {
      return v.toFixed(1);
    }
    if (unit === '%') {
      return Math.round(v).toString();
    }
    return v.toString();
  };

  const renderTrend = () => {
    if (trend_delta === null || trend_delta === undefined) {
      return (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Minus className="w-3.5 h-3.5" /> Steady
        </span>
      );
    }
    if (trend_delta > 0) {
      return (
        <span className="text-xs text-sky-400 font-medium flex items-center gap-1 font-mono">
          <TrendingUp className="w-3.5 h-3.5" /> +{trend_delta} {unit}
        </span>
      );
    }
    if (trend_delta < 0) {
      return (
        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 font-mono">
          <TrendingDown className="w-3.5 h-3.5" /> {trend_delta} {unit}
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
        <Minus className="w-3.5 h-3.5" /> 0.0 {unit}
      </span>
    );
  };

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4.5 hover:border-slate-600 transition-colors shadow-sm flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-surface-elevated text-slate-300 border border-slate-700/50">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300">{title}</h3>
            {description && (
              <p className="text-[11px] text-slate-500 truncate max-w-[130px]">{description}</p>
            )}
          </div>
        </div>
        <QualityPill quality={quality} />
      </div>

      {/* Main Metric Value & Sparkline Row */}
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {formatValue(current)}
            </span>
            <span className="text-sm font-medium text-slate-400">{unit}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">{renderTrend()}</div>
        </div>

        {/* Mini Sparkline Chart */}
        <div className="w-28 h-12">
          {sparkline && sparkline.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <YAxis domain={['auto', 'auto']} hide />
                <Line
                  type="monotone"
                  dataKey="val"
                  stroke={colorHex}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-slate-600 font-mono">
              Collecting data
            </div>
          )}
        </div>
      </div>

      {/* Footer Timestamp */}
      <div className="mt-3 pt-2.5 border-t border-surface-border/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>Updated:</span>
        <span>
          {last_updated ? new Date(last_updated).toLocaleTimeString() : 'Awaiting sync'}
        </span>
      </div>
    </div>
  );
};
