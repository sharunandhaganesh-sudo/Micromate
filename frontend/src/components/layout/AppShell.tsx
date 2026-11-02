import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  History,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { MicroMateChat } from '../micromate/MicroMateChat';
import { MicroMateAlertBanner, ActiveAlertData } from '../micromate/MicroMateAlertBanner';
import { useSimulator } from '../../context/SimulatorContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const { stations, selectedStationId, latestEvent } = useSimulator();

  const [activeAlert, setActiveAlert] = useState<ActiveAlertData | null>(null);
  const seenIncidentIds = React.useRef<Set<string>>(new Set());

  // Poll active incidents globally to trigger MicroMate alert banners
  const { data: incidents } = useQuery({
    queryKey: ['global-active-incidents', selectedStationId],
    queryFn: () => api.getIncidents({ station_id: selectedStationId || undefined, status: 'ACTIVE' }),
    refetchInterval: 3000,
  });

  // Watch for new incidents and pop up MicroMate alert banner
  React.useEffect(() => {
    if (incidents && incidents.length > 0) {
      const top = incidents[0];
      if (!seenIncidentIds.current.has(top.id)) {
        seenIncidentIds.current.add(top.id);

        let rec = 'Monitor station parameters closely and ensure field sensors are stable.';
        if (top.event_type.includes('RAIN')) {
          rec = 'Heavy rainfall detected. Check local drainage conduits and avoid low-lying exposed areas.';
        } else if (top.event_type.includes('TEMP')) {
          rec = 'High ambient heat advisory. Ensure sensitive hardware is shaded and stay hydrated.';
        } else if (top.event_type.includes('WIND')) {
          rec = 'Severe wind gust advisory. Secure loose instruments and lightweight structures.';
        } else if (top.event_type.includes('PRESSURE')) {
          rec = 'Rapid barometric drop detected. Approaching frontal squall or convective boundary.';
        }

        setActiveAlert({
          id: top.id,
          eventType: top.event_type,
          severity: top.severity,
          title: `${top.event_type.replace(/_/g, ' ')} DETECTED!`,
          description: top.evidence_summary || 'Monitored parameter has crossed safe configured threshold limits.',
          recommendation: rec,
          measuredValue: top.triggering_value,
          thresholdValue: top.threshold_value,
          unit: top.event_type.includes('TEMP') ? '°C' : top.event_type.includes('RAIN') ? 'mm/h' : top.event_type.includes('WIND') ? 'm/s' : '',
          isSimulated: top.is_simulated,
          timestamp: new Date(top.last_occurrence || top.start_time).toLocaleTimeString(),
        });
      }
    }
  }, [incidents]);

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const isDemo = selectedStation?.is_demo ?? true;

  const mobileNavItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Live', to: '/live', icon: Activity },
    { name: 'Alerts', to: '/events', icon: AlertTriangle },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-surface-subtle text-navy-900 overflow-hidden font-sans">
      {/* Desktop & Tablet Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenOnboarding={() => setOnboardingOpen(true)}
        />

        {/* Dynamic Page Router Outlet */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar (Visible only on small screens) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-surface-border px-2 py-1.5 flex items-center justify-around shadow-lg">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
                    isActive
                      ? 'text-primary-600 font-bold'
                      : 'text-navy-500 hover:text-navy-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Guided Onboarding Modal */}
      <OnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* MicroMate Assistant Floating Companion */}
      <MicroMateChat />

      {/* Global Realtime MicroMate Alert Banner */}
      <MicroMateAlertBanner
        alert={activeAlert}
        onDismiss={() => setActiveAlert(null)}
      />
    </div>
  );
};
