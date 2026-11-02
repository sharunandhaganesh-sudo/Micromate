import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { SimulatorProvider } from './context/SimulatorContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { WeatherAnalyticsPage } from './pages/WeatherAnalyticsPage';
import { StationsDevicesPage } from './pages/StationsDevicesPage';
import { EventsAlertsPage } from './pages/EventsAlertsPage';
import { HistoricalDataPage } from './pages/HistoricalDataPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 4000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SimulatorProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="live" element={<LiveMonitoringPage />} />
                <Route path="events" element={<EventsAlertsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="analytics" element={<Navigate to="/live" replace />} />
                <Route path="stations" element={<Navigate to="/settings" replace />} />
                <Route path="history" element={<Navigate to="/live" replace />} />
                <Route path="reports" element={<Navigate to="/events" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SimulatorProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
