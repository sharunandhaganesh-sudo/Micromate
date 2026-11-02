import React from 'react';

interface QualityPillProps {
  quality: string;
}

export const QualityPill: React.FC<QualityPillProps> = ({ quality }) => {
  const q = (quality || 'VALID').toUpperCase();

  let color = 'bg-slate-800 text-slate-400 border-slate-700';
  let title = 'Data quality normal';

  if (q === 'VALID') {
    color = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40';
    title = 'Within physical limits and passed verification';
  } else if (q === 'SUSPECT') {
    color = 'bg-amber-950/60 text-amber-400 border-amber-800/40';
    title = 'Rapid value jump or frozen sensor pattern detected';
  } else if (q === 'INVALID') {
    color = 'bg-rose-950/60 text-rose-400 border-rose-800/40';
    title = 'Hardware sensor fault or physical limit violated';
  } else if (q === 'MISSING') {
    color = 'bg-slate-800/80 text-slate-400 border-slate-700/50';
    title = 'Sensor not connected or telemetry field missing';
  } else if (q === 'STALE') {
    color = 'bg-yellow-950/60 text-yellow-400 border-yellow-800/40';
    title = 'Observation older than configured freshness limit';
  }

  return (
    <span
      title={title}
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-medium ${color}`}
    >
      {q}
    </span>
  );
};
