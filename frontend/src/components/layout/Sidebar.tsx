import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  History,
  AlertTriangle,
  Settings,
  X,
  Radio,
} from 'lucide-react';
import { MicroMateAvatar } from '../micromate/MicroMateAvatar';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  // Exactly 4 Production Navigation Items
  const navItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Live Monitoring', to: '/live', icon: Activity },
    { name: 'Alerts', to: '/events', icon: AlertTriangle },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-navy-900/30 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-surface-border flex flex-col transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MicroMateAvatar emotion="happy" size="sm" />
            <div>
              <span className="font-bold text-navy-900 text-sm tracking-tight flex items-center gap-1">
                Microclimate
                <span className="text-emerald-500 text-xs">☘️</span>
              </span>
              <span className="block text-[10px] text-primary-600 font-medium tracking-wide">
                MicroMate Platform
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="p-1 rounded-lg text-slate-400 hover:text-navy-700 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border border-primary-200/80 shadow-xs'
                      : 'text-navy-600 hover:text-navy-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Hardware & Cloud Badge */}
        <div className="p-4 border-t border-surface-border bg-slate-50 text-[11px] text-navy-500">
          <div className="flex items-center justify-between">
            <span className="font-medium text-navy-600">Hardware Node:</span>
            <span className="font-mono text-navy-700">ESP32 + BME280</span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="font-medium text-navy-600 flex items-center gap-1">
              <Radio className="w-3 h-3 text-primary-600" /> Cloud Stream:
            </span>
            <span className="font-mono text-primary-600 font-semibold">ThingSpeak</span>
          </div>
        </div>
      </aside>
    </>
  );
};
