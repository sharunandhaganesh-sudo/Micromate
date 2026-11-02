import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
}) => {
  const norm = (status || 'unknown').toLowerCase();

  let bg = 'bg-slate-100 text-slate-700 border-slate-200';
  let dot = 'bg-slate-400';

  if (['normal', 'online', 'valid', 'active', 'completed'].includes(norm)) {
    bg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    dot = 'bg-emerald-500';
  } else if (['advisory', 'stale', 'suspect', 'acknowledged', 'pending'].includes(norm)) {
    bg = 'bg-amber-50 text-amber-800 border-amber-200';
    dot = 'bg-amber-500';
  } else if (['warning', 'dismissed'].includes(norm)) {
    bg = 'bg-orange-50 text-orange-800 border-orange-200';
    dot = 'bg-orange-500';
  } else if (['critical', 'offline', 'invalid', 'failed'].includes(norm)) {
    bg = 'bg-rose-50 text-rose-800 border-rose-200';
    dot = 'bg-rose-500';
  } else if (['never_connected', 'missing', 'resolved'].includes(norm)) {
    bg = 'bg-slate-100 text-slate-600 border-slate-200';
    dot = 'bg-slate-400';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-mono uppercase tracking-wider whitespace-nowrap shrink-0 ${sizeClasses[size]} ${bg}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot} ${
            ['online', 'critical'].includes(norm) ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span>{status}</span>
    </span>
  );
};
