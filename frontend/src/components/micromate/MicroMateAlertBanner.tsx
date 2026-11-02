import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, X, ExternalLink, Volume2, ShieldAlert } from 'lucide-react';
import { MicroMateAvatar, MicroMateEmotion } from './MicroMateAvatar';

export interface ActiveAlertData {
  id: string;
  ruleCode?: string;
  eventType: string;
  severity: 'advisory' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  measuredValue?: number | string | null;
  thresholdValue?: number | string | null;
  unit?: string;
  isSimulated: boolean;
  timestamp: string;
}

interface MicroMateAlertBannerProps {
  alert: ActiveAlertData | null;
  onDismiss: () => void;
  onViewAlerts?: () => void;
  soundEnabled?: boolean;
}

export const MicroMateAlertBanner: React.FC<MicroMateAlertBannerProps> = ({
  alert,
  onDismiss,
  onViewAlerts,
  soundEnabled = false,
}) => {
  const navigate = useNavigate();

  if (!alert) return null;

  // Emotion mapping based on severity
  const emotion: MicroMateEmotion =
    alert.severity === 'critical'
      ? 'in_alert'
      : alert.severity === 'warning'
      ? 'worried'
      : 'thinking';

  // Severity style configuration
  const configMap = {
    critical: {
      border: 'border-rose-400',
      bg: 'bg-rose-50/95',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      text: 'text-rose-900',
      highlight: 'text-rose-700',
      icon: ShieldAlert,
    },
    warning: {
      border: 'border-orange-400',
      bg: 'bg-orange-50/95',
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
      text: 'text-orange-900',
      highlight: 'text-orange-700',
      icon: AlertTriangle,
    },
    advisory: {
      border: 'border-amber-400',
      bg: 'bg-amber-50/95',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      text: 'text-amber-900',
      highlight: 'text-amber-700',
      icon: Info,
    },
  };

  const cfg = configMap[alert.severity] || configMap.warning;
  const Icon = cfg.icon;

  const handleNavigate = () => {
    if (onViewAlerts) {
      onViewAlerts();
    } else {
      navigate('/events');
    }
    onDismiss();
  };

  return (
    <div
      role="alert"
      className="fixed top-16 sm:top-20 inset-x-2 sm:inset-x-auto sm:right-6 z-50 sm:max-w-md animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} backdrop-blur-md p-3.5 sm:p-4 shadow-2xl transition-all flex flex-col gap-2.5`}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between pb-2 border-b border-navy-200/40">
          <div className="flex items-center gap-2 min-w-0">
            <MicroMateAvatar emotion={emotion} size="sm" isFloating />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-navy-900 truncate">
                  MicroMate Weather Alert
                </span>
                {alert.isSimulated ? (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-mono font-bold whitespace-nowrap">
                    SIMULATED
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-mono font-bold whitespace-nowrap">
                    REAL FIELD
                  </span>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase font-bold border ${cfg.badge} inline-block mt-0.5 whitespace-nowrap`}>
                {alert.severity} • {alert.eventType.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={onDismiss}
            aria-label="Dismiss alert popup"
            className="p-1 rounded-lg text-navy-500 hover:text-navy-900 hover:bg-black/5 transition shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert Body */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 shrink-0 text-navy-800" />
            <h4 className="text-sm font-bold text-navy-900 leading-tight">
              {alert.title}
            </h4>
          </div>

          {alert.measuredValue !== undefined && alert.measuredValue !== null && (
            <p className="text-xs font-mono font-semibold text-navy-800 bg-white/70 px-2.5 py-1 rounded-lg border border-navy-200/40 inline-block">
              Observed Value:{' '}
              <span className={cfg.highlight}>
                {alert.measuredValue} {alert.unit || ''}
              </span>
              {alert.thresholdValue && (
                <span className="text-navy-500 font-normal ml-1">
                  (threshold: {alert.thresholdValue} {alert.unit || ''})
                </span>
              )}
            </p>
          )}

          <p className="text-xs text-navy-800 leading-relaxed font-sans">
            {alert.description}
          </p>

          <div className="bg-white/80 p-2.5 rounded-xl border border-navy-200/40 text-[11px] text-navy-800">
            <strong className="text-navy-900">Recommended Action: </strong>
            {alert.recommendation}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-[10px] text-navy-500 font-mono">
            {alert.timestamp}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-navy-600 hover:bg-black/5 transition"
            >
              Dismiss
            </button>
            <button
              onClick={handleNavigate}
              className="px-3.5 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition"
            >
              <span>View Alerts</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
