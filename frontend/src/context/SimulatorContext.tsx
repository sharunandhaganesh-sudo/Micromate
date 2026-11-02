import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { SimulatorState, Station } from '../types';
import { api } from '../api/client';

interface RealtimeTelemetryEvent {
  type: string;
  station_id: string;
  device_id: string;
  device_identifier: string;
  timestamp: string;
  measurements: Record<string, any>;
  quality_flags: Record<string, string>;
  is_simulated: boolean;
  health: {
    battery_voltage_v?: number | null;
    battery_percent?: number | null;
    wifi_rssi_dbm?: number | null;
  };
  new_incidents_count: number;
}

interface SimulatorContextType {
  state: SimulatorState | null;
  loading: boolean;
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
  stations: Station[];
  refreshStations: () => Promise<void>;
  startSimulator: (speed?: number) => Promise<void>;
  pauseSimulator: () => Promise<void>;
  resumeSimulator: () => Promise<void>;
  stopSimulator: () => Promise<void>;
  resetSimulator: () => Promise<void>;
  setScenario: (scenario: string) => Promise<void>;
  injectAnomaly: (metric: string, value: number, duration?: number) => Promise<void>;
  wsConnected: boolean;
  latestEvent: RealtimeTelemetryEvent | null;
  recentEvents: RealtimeTelemetryEvent[];
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [latestEvent, setLatestEvent] = useState<RealtimeTelemetryEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeTelemetryEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchStations = async () => {
    try {
      const list = await api.getStations();
      setStations(list);
      if (list.length > 0 && !selectedStationId) {
        setSelectedStationId(list[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch stations:', e);
    }
  };

  const fetchState = async () => {
    try {
      const s = await api.getSimulatorState();
      setState(s);
    } catch (e) {
      console.warn('Failed to fetch simulator state:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket connection for real-time live push
  useEffect(() => {
    let reconnectTimeout: any;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // In dev with Vite proxy, ws://localhost:5173/ws/telemetry is proxied to :8000
      const wsUrl = `${protocol}//${host}/ws/telemetry`;

      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
          console.log('Realtime telemetry WebSocket connected.');
        };

        socket.onmessage = (event) => {
          try {
            const data: RealtimeTelemetryEvent = JSON.parse(event.data);
            setLatestEvent(data);
            setRecentEvents((prev) => [data, ...prev.slice(0, 49)]);
          } catch (err) {
            console.error('Error parsing telemetry WebSocket message:', err);
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        };

        socket.onerror = (err) => {
          console.warn('WebSocket error, retrying...', err);
          socket.close();
        };
      } catch (e) {
        console.warn('Could not establish WebSocket, fallback to polling.', e);
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startSimulator = async (speed?: number) => {
    const s = await api.controlSimulator('start', speed);
    setState(s);
  };

  const pauseSimulator = async () => {
    const s = await api.controlSimulator('pause');
    setState(s);
  };

  const resumeSimulator = async () => {
    const s = await api.controlSimulator('resume');
    setState(s);
  };

  const stopSimulator = async () => {
    const s = await api.controlSimulator('stop');
    setState(s);
  };

  const resetSimulator = async () => {
    const s = await api.controlSimulator('reset');
    setState(s);
  };

  const setScenario = async (scenario: string) => {
    const s = await api.setSimulatorScenario(scenario);
    setState(s);
  };

  const injectAnomaly = async (metric: string, value: number, duration?: number) => {
    await api.injectSimulatorAnomaly(metric, value, duration);
  };

  return (
    <SimulatorContext.Provider
      value={{
        state,
        loading,
        selectedStationId,
        setSelectedStationId,
        stations,
        refreshStations: fetchStations,
        startSimulator,
        pauseSimulator,
        resumeSimulator,
        stopSimulator,
        resetSimulator,
        setScenario,
        injectAnomaly,
        wsConnected,
        latestEvent,
        recentEvents,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};

export const useSimulator = () => {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
};
