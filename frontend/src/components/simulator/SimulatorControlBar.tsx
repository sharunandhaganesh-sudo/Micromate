import React, { useState } from 'react';
import {
  Play, Pause, Square, RotateCcw, Zap, Sparkles, Activity, FastForward,
  ChevronDown, AlertTriangle, Cpu
} from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';

interface SimulatorControlBarProps {
  onOpenOnboarding: () => void;
}

export const SimulatorControlBar: React.FC<SimulatorControlBarProps> = ({ onOpenOnboarding }) => {
  const {
    state,
    startSimulator,
    pauseSimulator,
    resumeSimulator,
    stopSimulator,
    resetSimulator,
    setScenario,
    injectAnomaly,
  } = useSimulator();

  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectMetric, setInjectMetric] = useState('temperature_c');
  const [injectValue, setInjectValue] = useState(42.5);

  const scenarioLabels: Record<string, string> = {
    normal_weather: 'Normal Weather (Diurnal Cycle)',
    temperature_spike: 'Temperature Spike (> 38°C)',
    heavy_rain: 'Heavy Convective Storm (Rain Burst)',
    strong_wind: 'High Wind Event (> 18 m/s Gusts)',
    rapid_pressure_drop: 'Rapid Pressure Drop (Frontal Squall)',
    sensor_disconnect: 'Sensor Disconnect / I2C Bus Error',
    wifi_outage: 'Wi-Fi Interruption (Packet Loss)',
    battery_decline: 'Battery Voltage Decline',
  };

  const handleInject = async () => {
    await injectAnomaly(injectMetric, injectValue, 60);
    setShowInjectModal(false);
  };

  const speedOptions = [1, 2, 5, 10];

  return (
    <div className="bg-white border-b border-surface-border px-4 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        
        {/* Left: Demo Badge & Mode indicator */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> DEMO SIMULATOR
          </span>
          <span className="text-xs text-navy-500 hidden sm:inline">
            Deterministic synthetic microclimate telemetry
          </span>
        </div>

        {/* Center: Simulator Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Scenario Select */}
          <div className="relative">
            <select
              value={state?.scenario || 'normal_weather'}
              onChange={(e) => setScenario(e.target.value)}
              className="bg-slate-50 text-navy-900 border border-surface-border text-xs rounded-lg px-2.5 py-1.5 pr-8 appearance-none focus:outline-none focus:border-primary-500 font-medium"
            >
              {Object.entries(scenarioLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-navy-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-surface-border">
            {state?.is_active ? (
              <button
                onClick={pauseSimulator}
                title="Pause telemetry stream"
                className="p-1.5 rounded hover:bg-slate-200 text-amber-600 transition"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => (state?.current_step && state.current_step > 0 ? resumeSimulator() : startSimulator())}
                title="Start telemetry playback"
                className="p-1.5 rounded hover:bg-slate-200 text-emerald-600 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            <button
              onClick={stopSimulator}
              title="Stop simulation"
              className="p-1.5 rounded hover:bg-slate-200 text-navy-500 hover:text-navy-900 transition"
            >
              <Square className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={resetSimulator}
              title="Reset state & step counter"
              className="p-1.5 rounded hover:bg-slate-200 text-navy-500 hover:text-navy-900 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Playback Speed selector */}
          <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-surface-border text-xs font-mono">
            {speedOptions.map((spd) => (
              <button
                key={spd}
                onClick={() => startSimulator(spd)}
                className={`px-2 py-1 rounded transition ${
                  state?.playback_speed === spd
                    ? 'bg-primary-600 text-white font-bold'
                    : 'text-navy-500 hover:text-navy-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Inject Anomaly */}
          <button
            onClick={() => setShowInjectModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium transition"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Inject Event</span>
          </button>
        </div>

        {/* Right: Step count and Hardware switch */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-navy-500 hidden md:block">
            Step: <span className="text-navy-900 font-semibold">{state?.current_step || 0}</span>
          </div>
          <button
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 text-xs font-medium transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Connect Real ESP32</span>
          </button>
        </div>

      </div>

      {/* Inject Modal */}
      {showInjectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-surface-border p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Inject Instantaneous Anomaly
              </h3>
              <button
                onClick={() => setShowInjectModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Directly override sensor readings for 60 seconds to immediately evaluate event engine detection and alert triggers.
            </p>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Metric</label>
                <select
                  value={injectMetric}
                  onChange={(e) => {
                    const m = e.target.value;
                    setInjectMetric(m);
                    if (m === 'temperature_c') setInjectValue(42.0);
                    if (m === 'rain_rate_mmh') setInjectValue(48.0);
                    if (m === 'wind_speed_mps') setInjectValue(22.0);
                    if (m === 'pressure_hpa') setInjectValue(992.0);
                  }}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  <option value="temperature_c">Temperature Spike (°C)</option>
                  <option value="rain_rate_mmh">Heavy Rain Rate (mm/h)</option>
                  <option value="wind_speed_mps">High Wind Gust (m/s)</option>
                  <option value="pressure_hpa">Extreme Low Pressure (hPa)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Injected Value ({injectMetric === 'temperature_c' ? '°C' : injectMetric === 'rain_rate_mmh' ? 'mm/h' : injectMetric === 'wind_speed_mps' ? 'm/s' : 'hPa'})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={injectValue}
                  onChange={(e) => setInjectValue(parseFloat(e.target.value))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-surface-border">
              <button
                onClick={() => setShowInjectModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleInject}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition"
              >
                Inject Anomaly
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
