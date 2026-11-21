import React, { useState } from 'react';
import {
  CheckCircle2, Sparkles, Cpu, Radio, Settings, ShieldCheck,
  ArrowRight, ArrowLeft, X, Copy, Check
} from 'lucide-react';
import { api } from '../../api/client';
import { useSimulator } from '../../context/SimulatorContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { refreshStations } = useSimulator();
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<'demo' | 'real'>('real');

  // Form states
  const [stationName, setStationName] = useState('MICROMATE Weather Monitoring');
  const [stationCode, setStationCode] = useState('STATION-MICROMATE-01');
  const [locationName, setLocationName] = useState('ESP32 Field Station');
  const [deviceId, setDeviceId] = useState('esp32-micromate-01');
  const [deviceName, setDeviceName] = useState('Field Node 01');

  const [createdStationId, setCreatedStationId] = useState<string | null>(null);
  const [createdDeviceId, setCreatedDeviceId] = useState<string | null>(null);
  const [deviceCreds, setDeviceCreds] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateStationAndDevice = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // 1. Create Station
      const st = await api.createStation({
        name: stationName,
        code: stationCode,
        location_name: locationName,
        is_demo: mode === 'demo',
        timezone: 'UTC',
      });
      setCreatedStationId(st.id);

      // 2. Register Device
      const dev = await api.createDevice({
        station_id: st.id,
        device_identifier: deviceId,
        name: deviceName,
        hardware_profile: mode === 'demo' ? 'Simulated Weather Station' : 'ESP32 + BME280 + Anemometer + RainGauge',
        firmware_version: '1.0.0',
        is_demo: mode === 'demo',
      });
      setCreatedDeviceId(dev.id);

      // 3. Fetch Credentials
      const creds = await api.getDeviceCredentials(dev.id);
      setDeviceCreds(creds);

      await refreshStations();
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize station and device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl border border-surface-border max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-surface-elevated/50">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-400" />
              Guided Station & Device Setup
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {step} of 5: {step === 1 ? 'Station Mode' : step === 2 ? 'Station Details' : step === 3 ? 'Device Profile' : step === 4 ? 'Hardware Provisioning' : 'Verification'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Mode Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-200">
                Choose Monitoring Station Environment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setMode('demo')}
                  className={`p-5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    mode === 'demo'
                      ? 'bg-primary-950/30 border-primary-500 shadow-md ring-1 ring-primary-500/50'
                      : 'bg-surface-elevated border-surface-border hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-primary-600/20 text-primary-400 flex items-center justify-center mb-3">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-slate-100 text-sm">Demo Simulation Station</h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Instant evaluation without physical hardware. Runs correlated synthetic scenarios (heatwaves, squalls, rain bursts).
                    </p>
                  </div>
                  <span className="mt-4 text-xs font-mono text-primary-400 font-medium">Recommended for testing</span>
                </div>

                <div
                  onClick={() => setMode('real')}
                  className={`p-5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    mode === 'real'
                      ? 'bg-primary-950/30 border-primary-500 shadow-md ring-1 ring-primary-500/50'
                      : 'bg-surface-elevated border-surface-border hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-3">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-slate-100 text-sm">Real ESP32 Weather Station</h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      Provision authentic device tokens, MQTT topics, and sensor calibration for physical ESP32 + BME280 hardware.
                    </p>
                  </div>
                  <span className="mt-4 text-xs font-mono text-emerald-400 font-medium">Production setup</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Station Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-200">Define Geographic Monitoring Station</h3>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Station Friendly Name</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. Ridgecrest Observatory"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Station Unique Code</label>
                <input
                  type="text"
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value.toUpperCase())}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. STATION-RC-01"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Installation Location Description</label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. North Ridge Weather Mast, Sector 4"
                />
              </div>
            </div>
          )}

          {/* Step 3: Device Registration */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-200">Register Primary Telemetry Node</h3>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Device Identifier (MQTT Device ID)</label>
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. esp32-node-01"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Used as the routing key in MQTT topic: microclimate/v1/devices/{deviceId || '{device_id}'}/telemetry
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Friendly Node Name</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  placeholder="e.g. Mast Sensor Node Alpha"
                />
              </div>
            </div>
          )}

          {/* Step 4: Hardware Credentials & Sensor Config */}
          {step === 4 && deviceCreds && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Station & device registered successfully! Copy your connection parameters below.
              </div>

              <div className="bg-surface-elevated p-4 rounded-xl border border-surface-border space-y-3 font-mono text-xs">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-sans">MQTT Broker Topic</div>
                  <div className="text-primary-300 mt-0.5">{deviceCreds.mqtt_topic_telemetry}</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-sans">HTTP / MQTT Provisioning Token</div>
                  <div className="flex items-center justify-between bg-background p-2 rounded border border-slate-700 mt-1">
                    <span className="text-slate-200 truncate mr-2">{deviceCreds.http_token}</span>
                    <button
                      onClick={() => copyToClipboard(deviceCreds.http_token)}
                      className="p-1 hover:text-white text-slate-400 flex items-center gap-1 font-sans text-[11px]"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[10px] uppercase font-sans">Hardware Sensor Assignment</div>
                  <div className="text-slate-300 text-[11px] font-sans mt-1">
                    • BME280 (I2C: 0x76) → Temp, Hum, Pressure<br />
                    • Anemometer (GPIO 14) → Wind Speed<br />
                    • Tipping Bucket (GPIO 27) → Rainfall (0.2794 mm/tip)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Verification & Complete */}
          {step === 5 && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Setup Fully Complete!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your station <strong className="text-slate-200">{stationName}</strong> is ready. Telemetry validation, automated quality flagging, and event detection rules are active.
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-elevated/40 flex items-center justify-between">
          {step > 1 && step < 5 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition ml-auto"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleCreateStationAndDevice}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition ml-auto"
            >
              {isSubmitting ? 'Creating...' : 'Provision Station & Device'}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={() => setStep(5)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium transition ml-auto"
            >
              Continue to Verification <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {step === 5 && (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition ml-auto"
            >
              Finish & View Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
