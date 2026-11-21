import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { MicroMateChat } from '../micromate/MicroMateChat';
export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const mobileNavItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Live', to: '/live', icon: Activity },
    { name: 'Alerts', to: '/events', icon: AlertTriangle },
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

    </div>
  );
};
