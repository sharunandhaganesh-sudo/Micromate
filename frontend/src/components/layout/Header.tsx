import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  ChevronDown,
  Menu,
  Clock,
  Radio,
  Wifi,
} from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { useAuth } from '../../context/AuthContext';
import { MicroMateAvatar } from '../micromate/MicroMateAvatar';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenOnboarding: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { stations, selectedStationId, setSelectedStationId, wsConnected } = useSimulator();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const isDemo = selectedStation?.is_demo ?? true;

  return (
    <header className="h-16 border-b border-surface-border bg-white px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-subtle">
      {/* Left: Mobile Toggle & Station Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-xl hover:bg-slate-100 text-navy-700 md:hidden shrink-0 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Station Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shrink-0">
            <CloudSun className="w-4 h-4" />
          </div>
          <div className="relative min-w-0">
            <select
              value={selectedStationId || ''}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="bg-slate-50 text-navy-900 text-xs sm:text-sm font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 pr-7 sm:pr-8 border border-surface-border appearance-none focus:outline-none focus:border-primary-500 cursor-pointer max-w-[150px] sm:max-w-[240px] truncate shadow-xs"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_demo ? '(Demo)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-navy-500 absolute right-2 sm:right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Live / Demo Status Pill */}
        <div className="hidden md:flex items-center shrink-0">
          {isDemo ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              DEMO MODE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              LIVE TELEMETRY
            </span>
          )}
        </div>
      </div>

      {/* Right: Telemetry Health, Clock & User */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
        {/* Realtime Stream indicator */}
        <div
          title={wsConnected ? 'Push connection active' : 'Connecting push socket...'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${
            wsConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="whitespace-nowrap">{wsConnected ? 'ONLINE' : 'CONNECTING'}</span>
        </div>

        {/* Current Time Clock */}
        <div className="hidden lg:flex items-center gap-1.5 text-navy-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-surface-border font-mono text-[11px] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-navy-500" />
          <span>{currentTime || '--:--:--'}</span>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-surface-border">
          <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-800 font-bold flex items-center justify-center text-xs uppercase border border-primary-200 shrink-0">
            {user?.username?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-navy-900 capitalize leading-tight">
              {user?.username || 'Operator'}
            </div>
            <div className="text-[10px] text-navy-500 uppercase tracking-wider font-mono font-medium leading-tight">
              {user?.role || 'viewer'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
