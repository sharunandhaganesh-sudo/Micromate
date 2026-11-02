import React from 'react';
import {
  Sensor3DThermometer,
  Sensor3DHumidity,
  Sensor3DBarometer,
  Sensor3DAnemometer,
  Sensor3DRainGauge,
} from './Realistic3DSensors';

export type SensorType = 'temperature' | 'humidity' | 'pressure' | 'wind' | 'rain';

interface SensorCardProps {
  type: SensorType;
  title: string;
  value: number | null | undefined;
  unit: string;
  statusText?: string;
  statusLevel?: 'normal' | 'caution' | 'warning' | 'critical' | 'unknown';
  lastUpdated?: string | null;
  secondaryLabel?: string;
  secondaryValue?: string | number | null;
}

export const RealisticSensorCard: React.FC<SensorCardProps> = ({
  type,
  title,
  value,
  unit,
  statusText = 'Normal',
  statusLevel = 'normal',
  lastUpdated,
  secondaryLabel,
  secondaryValue,
}) => {
  const renderVisual = () => {
    switch (type) {
      case 'temperature':
        return <Sensor3DThermometer value={value ?? null} className="w-20 h-20 sm:w-24 sm:h-24" />;
      case 'humidity':
        return <Sensor3DHumidity value={value ?? null} className="w-20 h-20 sm:w-24 sm:h-24" />;
      case 'pressure':
        return <Sensor3DBarometer value={value ?? null} className="w-20 h-20 sm:w-24 sm:h-24" />;
      case 'wind':
        return <Sensor3DAnemometer value={value ?? null} className="w-20 h-20 sm:w-24 sm:h-24" />;
      case 'rain':
        return <Sensor3DRainGauge value={value ?? null} className="w-20 h-20 sm:w-24 sm:h-24" />;
    }
  };

  const statusBadgeMap = {
    normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    caution: 'bg-amber-50 text-amber-700 border-amber-200',
    warning: 'bg-orange-50 text-orange-700 border-orange-200',
    critical: 'bg-rose-50 text-rose-700 border-rose-200',
    unknown: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const statusDotMap = {
    normal: 'bg-emerald-500',
    caution: 'bg-amber-500',
    warning: 'bg-orange-500',
    critical: 'bg-rose-500',
    unknown: 'bg-slate-400',
  };

  const displayVal = value !== null && value !== undefined ? value.toFixed(1) : 'No Data';

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card hover:shadow-elevated transition-all duration-300 flex flex-col justify-between group">
      {/* Top Header: Parameter Title & Status Pill */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-navy-600 uppercase tracking-wider">
          {title}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1.5 ${
            statusBadgeMap[statusLevel] || statusBadgeMap.normal
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              statusDotMap[statusLevel] || statusDotMap.normal
            } ${statusLevel !== 'normal' && statusLevel !== 'unknown' ? 'animate-pulse' : ''}`}
          />
          {statusText}
        </span>
      </div>

      {/* Center Hero: 3D Illustration & Large Numeric Value */}
      <div className="flex items-center justify-between my-4 gap-3">
        {/* Value & Unit */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight font-sans">
              {displayVal}
            </span>
            {value !== null && value !== undefined && (
              <span className="text-base sm:text-lg font-semibold text-navy-500">
                {unit}
              </span>
            )}
          </div>

          {secondaryLabel && secondaryValue !== undefined && secondaryValue !== null && (
            <p className="text-xs text-navy-500 mt-1 font-mono">
              {secondaryLabel}: <strong className="text-navy-700 font-semibold">{secondaryValue}</strong>
            </p>
          )}
        </div>

        {/* 3D Visual Asset */}
        <div className="shrink-0 transform group-hover:scale-105 transition-transform duration-300">
          {renderVisual()}
        </div>
      </div>

      {/* Card Footer: Last Updated timestamp */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Sensor Parameter</span>
        <span className="font-mono">{lastUpdated || 'Live Telemetry'}</span>
      </div>
    </div>
  );
};
