import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cpu, Radio, Plus, Settings, ShieldCheck, Key, RefreshCw,
  Edit2, Trash2, CheckCircle2, Sliders, MapPin, Copy, Check
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { QualityPill } from '../components/common/QualityPill';
import { Station, Device } from '../types';

export const StationsDevicesPage: React.FC = () => {
  const { stations, selectedStationId, setSelectedStationId, refreshStations } = useSimulator();

  const [activeTab, setActiveTab] = useState<'overview' | 'sensors' | 'credentials' | 'maintenance'>('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevIdentifier, setNewDevIdentifier] = useState('');
  const [newDevName, setNewDevName] = useState('');

  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibSensor, setCalibSensor] = useState('BME280_TEMP');
  const [calibFactor, setCalibFactor] = useState(1.0);
  const [calibOffset, setCalibOffset] = useState(0.0);
  const [calibNotes, setCalibNotes] = useState('Laboratory offset calibration against reference');

  const [copiedToken, setCopiedToken] = useState(false);

  // Query devices for selected station
  const { data: devices, refetch: refetchDevices } = useQuery({
    queryKey: ['devices', selectedStationId],
    queryFn: () => api.getDevices(selectedStationId || undefined),
  });

  const activeDevice = devices?.find((d) => d.id === selectedDeviceId) || (devices && devices[0]) || null;

  // Query sensor configs for active device
  const { data: sensors, refetch: refetchSensors } = useQuery({
    queryKey: ['sensors', activeDevice?.id],
    queryFn: () => (activeDevice ? api.getDeviceSensors(activeDevice.id) : Promise.resolve([])),
    enabled: !!activeDevice,
  });

  // Query credentials for active device
  const { data: credentials } = useQuery({
    queryKey: ['credentials', activeDevice?.id],
    queryFn: () => (activeDevice ? api.getDeviceCredentials(activeDevice.id) : Promise.resolve(null)),
    enabled: !!activeDevice,
  });

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStationId || !newDevIdentifier || !newDevName) return;
    try {
      await api.createDevice({
        station_id: selectedStationId,
        device_identifier: newDevIdentifier,
        name: newDevName,
        hardware_profile: 'ESP32 / BME280 / Anemometer / RainGauge',
        firmware_version: '1.0.0',
        is_demo: false,
      });
      setShowAddDeviceModal(false);
      setNewDevIdentifier('');
      setNewDevName('');
      refetchDevices();
    } catch (err: any) {
      alert(err.message || 'Failed to register device');
    }
  };

  const handleApplyCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDevice) return;
    try {
      await api.addCalibration(activeDevice.id, {
        sensor_type: calibSensor,
        calibration_factor: calibFactor,
        calibration_offset: calibOffset,
        performed_by: 'Operator Session',
        notes: calibNotes,
      });
      setShowCalibrationModal(false);
      refetchSensors();
      alert('Sensor calibration successfully recorded and applied to ingestion!');
    } catch (err: any) {
      alert(err.message || 'Failed to apply calibration');
    }
  };

  const copyCred = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border/60 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Stations & Hardware Nodes
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage physical monitoring stations, ESP32 device identities, credentials, and sensor calibrations.
          </p>
        </div>

        <button
          onClick={() => setShowAddDeviceModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs transition self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register New Device Node</span>
        </button>
      </div>

      {/* Main Grid: Station/Device Selector Sidebar + Detail Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Device & Station Hierarchy */}
        <div className="space-y-4">
          <div className="bg-surface rounded-2xl border border-surface-border p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 font-mono">
              Monitoring Station
            </h3>
            {selectedStation && (
              <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border">
                <div className="font-semibold text-sm text-slate-100">{selectedStation.name}</div>
                <div className="text-xs text-primary-400 font-mono mt-0.5">{selectedStation.code}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedStation.location_name}</span>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-700/60 text-[11px] font-mono text-slate-500">
                  <span>Timezone: {selectedStation.timezone}</span>
                  {selectedStation.is_demo ? (
                    <span className="text-amber-400">DEMO</span>
                  ) : (
                    <span className="text-emerald-400">PRODUCTION</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-2xl border border-surface-border p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 font-mono flex items-center justify-between">
              <span>Assigned Devices</span>
              <span className="text-slate-500">{devices?.length || 0} nodes</span>
            </h3>

            <div className="space-y-2">
              {devices && devices.length > 0 ? (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    onClick={() => setSelectedDeviceId(dev.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      (activeDevice?.id === dev.id)
                        ? 'bg-primary-950/30 border-primary-500 ring-1 ring-primary-500/40'
                        : 'bg-surface-elevated border-surface-border hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-200">{dev.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{dev.device_identifier}</div>
                    </div>
                    <StatusBadge status={dev.status} size="sm" />
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  No devices assigned yet. Click Register New Device Node above.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Selected Device Detail Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {activeDevice ? (
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              {/* Tab Header */}
              <div className="px-6 py-4 border-b border-surface-border flex flex-wrap items-center justify-between gap-4 bg-surface-elevated/40">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary-400" />
                    {activeDevice.name}
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {activeDevice.device_identifier} • Status: {activeDevice.status}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5 border border-surface-border text-xs">
                  {(['overview', 'sensors', 'credentials', 'maintenance'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-3 py-1.5 rounded-md capitalize transition font-medium ${
                        activeTab === t
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                      <span className="text-slate-500 uppercase text-[10px] block">Hardware Profile</span>
                      <span className="text-slate-200 font-semibold">{activeDevice.hardware_profile}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                      <span className="text-slate-500 uppercase text-[10px] block">Firmware Version</span>
                      <span className="text-slate-200 font-semibold">v{activeDevice.firmware_version}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                      <span className="text-slate-500 uppercase text-[10px] block">Last Seen</span>
                      <span className="text-slate-200">
                        {activeDevice.last_seen_at ? new Date(activeDevice.last_seen_at).toLocaleString() : 'Never'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border space-y-2">
                      <span className="text-slate-500 uppercase text-[10px] block">Telemetry Freshness</span>
                      <span className="text-slate-200">
                        {activeDevice.last_telemetry_at ? new Date(activeDevice.last_telemetry_at).toLocaleTimeString() : 'No data received'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase font-mono mb-2">
                      Device Notes & Deployment Documentation
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      {activeDevice.notes || 'ESP32 field unit deployed for high-resolution microclimate observation. Interfaced with Bosch BME280 precision atmospheric sensor suite, cup anemometer generator, and magnetic reed switch rain gauge.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Sensors Configuration & Calibration */}
              {activeTab === 'sensors' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">Configured Sensor Suite</h3>
                      <p className="text-xs text-slate-400">
                        Per-sensor pin assignments, sampling intervals, and linear calibration equations: [val = raw * factor + offset]
                      </p>
                    </div>

                    <button
                      onClick={() => setShowCalibrationModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-slate-700 hover:border-slate-500 text-xs text-primary-400 font-medium transition"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Calibrate Sensor</span>
                    </button>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    {sensors && sensors.length > 0 ? (
                      sensors.map((s) => (
                        <div
                          key={s.id}
                          className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between gap-4"
                        >
                          <div>
                            <div className="font-bold text-slate-200">{s.sensor_type}</div>
                            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                              Bus/Pin: {s.pin_or_bus || 'Default'} • Interval: {s.sampling_interval_s}s
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-slate-300">
                              Factor: <strong className="text-primary-400">{s.calibration_factor}</strong> | Offset: <strong className="text-primary-400">{s.calibration_offset}</strong>
                            </div>
                            <div className="mt-1">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                                ACTIVE
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No sensors configured for this node.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Credentials & MQTT Access Control */}
              {activeTab === 'credentials' && credentials && (
                <div className="p-6 space-y-6 font-mono text-xs">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 font-sans">
                      Provisioned Device Credentials & Topics
                    </h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Use these credentials in your ESP32 Arduino/ESP-IDF firmware to connect over MQTT TLS or HTTP.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border">
                      <div className="text-slate-400 text-[10px] uppercase font-sans">MQTT Client Topic</div>
                      <div className="text-primary-300 font-bold mt-1 select-all">{credentials.mqtt_topic_telemetry}</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border">
                      <div className="text-slate-400 text-[10px] uppercase font-sans">Device Access Token (HTTP / MQTT auth)</div>
                      <div className="flex items-center justify-between bg-background p-2.5 rounded-lg border border-slate-700 mt-1">
                        <span className="text-slate-200 truncate mr-3">{credentials.http_token}</span>
                        <button
                          onClick={() => copyCred(credentials.http_token)}
                          className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 font-sans font-medium"
                        >
                          {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-surface-border">
                      <div className="text-slate-400 text-[10px] uppercase font-sans">MQTT Broker Username</div>
                      <div className="text-slate-200 mt-1">{credentials.mqtt_username}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Maintenance */}
              {activeTab === 'maintenance' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Device Maintenance Actions</h3>
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-200">Rotate Device Credentials</h4>
                        <p className="text-[11px] text-slate-400">Invalidates existing tokens and provisions fresh cryptographic keys.</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-slate-700 hover:border-slate-500 text-xs text-slate-300 font-medium">
                        Rotate Token
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-elevated border border-rose-900/40 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-rose-300">Deregister Device</h4>
                        <p className="text-[11px] text-slate-400">Permanently removes device and revokes broker authorization.</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete device ${activeDevice.name}?`)) {
                            await api.deleteStation(activeDevice.id);
                            refetchDevices();
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900/80 text-xs font-medium"
                      >
                        Delete Node
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-surface-border p-12 text-center text-slate-500 text-xs">
              Select or register a device to view hardware profile, calibration, and credentials.
            </div>
          )}
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-surface-border p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Register Telemetry Device</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a new hardware node (e.g. ESP32 microcontroller) to station {selectedStation?.name}.
            </p>

            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Device Identifier (MQTT Device ID)</label>
                <input
                  type="text"
                  required
                  value={newDevIdentifier}
                  onChange={(e) => setNewDevIdentifier(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. esp32-roof-02"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Friendly Name</label>
                <input
                  type="text"
                  required
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  placeholder="e.g. South Roof Micro Station"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs transition"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sensor Calibration Modal */}
      {showCalibrationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-surface-border p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Calibrate Sensor Offset</h3>
            <p className="text-xs text-slate-400 mb-4">
              Update calibration coefficients for {activeDevice?.name}. Applied automatically in backend ingestion.
            </p>

            <form onSubmit={handleApplyCalibration} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sensor</label>
                <select
                  value={calibSensor}
                  onChange={(e) => setCalibSensor(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  <option value="BME280_TEMP">BME280 Temperature (°C)</option>
                  <option value="BME280_HUM">BME280 Humidity (%)</option>
                  <option value="BME280_PRESS">BME280 Pressure (hPa)</option>
                  <option value="ANEMOMETER">Cup Anemometer (m/s)</option>
                  <option value="RAIN_GAUGE">Tipping Bucket Gauge (mm/tip)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Multiplier Factor</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={calibFactor}
                    onChange={(e) => setCalibFactor(parseFloat(e.target.value))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Additive Offset</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={calibOffset}
                    onChange={(e) => setCalibOffset(parseFloat(e.target.value))}
                    className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Calibration Notes</label>
                <input
                  type="text"
                  value={calibNotes}
                  onChange={(e) => setCalibNotes(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowCalibrationModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs transition"
                >
                  Save Calibration Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
