import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings, Sliders, Bell, Shield, User, Send, CheckCircle2,
  AlertTriangle, Key, Save, RefreshCw, Lock, Cloud, Radio, Wifi
} from 'lucide-react';
import { api, apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { EventRule, ThingSpeakConfig, ThingSpeakTestResult } from '../types';

export const SettingsPage: React.FC = () => {
  const { user, login, isAdmin, isOperator } = useAuth();
  const [activeTab, setActiveTab] = useState<'rules' | 'thingspeak' | 'notifications' | 'general' | 'security'>('rules');

  // Rules query
  const { data: rules, refetch: refetchRules } = useQuery({
    queryKey: ['event-rules'],
    queryFn: () => api.getRules(),
  });

  // ThingSpeak query
  const { data: tsConfig, refetch: refetchTsConfig, isLoading: isTsLoading } = useQuery({
    queryKey: ['thingspeak-config'],
    queryFn: () => apiClient.getThingSpeakConfig(),
  });

  const [tsForm, setTsForm] = useState<Partial<ThingSpeakConfig>>({});
  const [tsTesting, setTsTesting] = useState(false);
  const [tsSyncing, setTsSyncing] = useState(false);
  const [tsTestResult, setTsTestResult] = useState<ThingSpeakTestResult | null>(null);
  const [tsSyncResult, setTsSyncResult] = useState<any | null>(null);
  const [tsSaveSuccess, setTsSaveSuccess] = useState(false);

  // Sync form state when tsConfig arrives
  React.useEffect(() => {
    if (tsConfig) {
      setTsForm(tsConfig);
    }
  }, [tsConfig]);

  // Notification preferences
  const { data: notifPref, refetch: refetchPref } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.getNotificationPreferences(),
  });

  // Audit logs (for admin)
  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(),
    enabled: isAdmin,
  });

  // Rule editing state
  const [editingRule, setEditingRule] = useState<EventRule | null>(null);
  const [editThreshold, setEditThreshold] = useState<number>(0);
  const [editRecovery, setEditRecovery] = useState<number>(0);
  const [editSeverity, setEditSeverity] = useState<string>('warning');
  const [editCooldown, setEditCooldown] = useState<number>(300);
  const [editEnabled, setEditEnabled] = useState<boolean>(true);

  // Notification testing state
  const [testChannel, setTestChannel] = useState<'IN_APP' | 'EMAIL' | 'TELEGRAM'>('IN_APP');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTestingNotif, setIsTestingNotif] = useState(false);

  // Role switch demo helper
  const handleSwitchRole = async (targetRole: string) => {
    try {
      if (targetRole === 'admin') {
        await login('admin', 'AdminPassword2026!');
      } else if (targetRole === 'operator') {
        await login('operator', 'OperatorPassword2026!');
      } else {
        await login('viewer', 'ViewerPassword2026!');
      }
    } catch (e: any) {
      alert(e.message || 'Failed to switch role');
    }
  };

  const handleOpenEditRule = (r: EventRule) => {
    setEditingRule(r);
    setEditThreshold(r.threshold);
    setEditRecovery(r.recovery_threshold ?? r.threshold);
    setEditSeverity(r.severity);
    setEditCooldown(r.cooldown_seconds);
    setEditEnabled(r.is_enabled);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      await api.updateRule(editingRule.id, {
        threshold: editThreshold,
        recovery_threshold: editRecovery,
        severity: editSeverity as any,
        cooldown_seconds: editCooldown,
        is_enabled: editEnabled,
      });
      setEditingRule(null);
      refetchRules();
      alert(`Rule '${editingRule.name}' updated!`);
    } catch (e: any) {
      alert(e.message || 'Failed to update rule');
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    setTestResult(null);
    try {
      const res = await api.testNotification(testChannel, 'Test notification from AeroPulse monitoring platform');
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, details: err.message });
    } finally {
      setIsTestingNotif(false);
    }
  };

  const handleSaveThingSpeak = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTsSaveSuccess(false);
      await apiClient.updateThingSpeakConfig(tsForm);
      setTsSaveSuccess(true);
      refetchTsConfig();
      setTimeout(() => setTsSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update ThingSpeak configuration');
    }
  };

  const handleTestThingSpeak = async () => {
    setTsTesting(true);
    setTsTestResult(null);
    try {
      const res = await apiClient.testThingSpeakConnection({
        channel_id: tsForm.channel_id || '',
        read_api_key: tsForm.read_api_key,
      });
      setTsTestResult(res);
    } catch (err: any) {
      setTsTestResult({ success: false, status: 'ERROR', message: err.message || 'Connection test failed' });
    } finally {
      setTsTesting(false);
    }
  };

  const handleSyncThingSpeakNow = async () => {
    setTsSyncing(true);
    setTsSyncResult(null);
    try {
      const res = await apiClient.syncThingSpeak();
      setTsSyncResult(res);
      refetchTsConfig();
    } catch (err: any) {
      setTsSyncResult({ success: false, message: err.message || 'Sync failed' });
    } finally {
      setTsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border/60 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            System Configuration & Detection Rules
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tune extreme weather anomaly thresholds, ThingSpeak cloud ingestion, notification integrations, and access control.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 rounded-xl p-1 border border-surface-border text-xs self-start sm:self-auto font-semibold">
          {(['rules', 'thingspeak', 'notifications', 'general', 'security'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg capitalize transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === t
                  ? 'bg-white text-navy-900 font-bold shadow-xs'
                  : 'text-navy-600 hover:text-navy-900'
              }`}
            >
              {t === 'thingspeak' && <Cloud className="w-3.5 h-3.5 text-primary-600" />}
              {t === 'thingspeak' ? 'ThingSpeak Cloud' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Event Rules & Thresholds */}
      {activeTab === 'rules' && (
        <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary-400" />
                Configured Extreme Weather Detection Rules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated against all incoming sensor observations. Changes apply immediately with version tracking.
              </p>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {rules && rules.length > 0 ? (
              rules.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-sans font-semibold text-slate-200 text-sm">
                      <span>{r.name}</span>
                      <StatusBadge status={r.severity} size="sm" />
                      {!r.is_enabled && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 font-sans text-xs">{r.description}</div>
                    <div className="flex items-center gap-4 text-slate-400 pt-1 text-[11px]">
                      <span>
                        Metric: <strong className="text-slate-200">{r.metric}</strong>
                      </span>
                      <span>
                        Threshold:{' '}
                        <strong className="text-primary-400">
                          {r.operator} {r.threshold} {r.unit}
                        </strong>
                      </span>
                      {r.recovery_threshold !== undefined && (
                        <span>
                          Recovery:{' '}
                          <strong className="text-emerald-400">
                            {r.recovery_threshold} {r.unit}
                          </strong>
                        </span>
                      )}
                      <span>
                        Cooldown: <strong className="text-slate-200">{r.cooldown_seconds}s</strong>
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenEditRule(r)}
                      className="px-3 py-1.5 rounded-lg bg-surface hover:bg-slate-700 text-slate-200 border border-slate-700 font-sans text-xs font-medium transition"
                    >
                      Edit Rule
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 font-sans">
                No event detection rules found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: ThingSpeak Cloud Integration */}
      {activeTab === 'thingspeak' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-surface-border p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-cyan-400" />
                  ThingSpeak Cloud Primary Ingestion Channel
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your real physical ESP32 weather station via ThingSpeak REST polling or Webhook sync.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestThingSpeak}
                  disabled={tsTesting}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  {tsTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={handleSyncThingSpeakNow}
                  disabled={tsSyncing}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 shadow-md shadow-cyan-900/40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${tsSyncing ? 'animate-spin' : ''}`} />
                  {tsSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>

            {/* Test / Sync Result Banner */}
            {tsTestResult && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                  tsTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/40 border-red-500/40 text-red-200'
                }`}
              >
                {tsTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{tsTestResult.message}</p>
                  {tsTestResult.channel_name && (
                    <p className="mt-1 font-mono text-[11px] text-emerald-300">
                      Channel: {tsTestResult.channel_name} • Last Entry #{tsTestResult.last_entry_id}
                    </p>
                  )}
                </div>
              </div>
            )}

            {tsSyncResult && (
              <div className="p-4 rounded-xl border bg-cyan-950/40 border-cyan-500/40 text-cyan-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>
                  Sync complete: <strong>{tsSyncResult.ingested_count}</strong> new observations ingested. (
                  {tsSyncResult.message})
                </span>
              </div>
            )}

            {tsSaveSuccess && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Configuration saved successfully!
              </div>
            )}

            {/* Form Settings */}
            <form onSubmit={handleSaveThingSpeak} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Channel ID
                  </label>
                  <input
                    type="text"
                    required
                    value={tsForm.channel_id || ''}
                    onChange={(e) => setTsForm({ ...tsForm, channel_id: e.target.value })}
                    placeholder="e.g. 2458901"
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your public or private channel ID from ThingSpeak.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Channel Name / Label
                  </label>
                  <input
                    type="text"
                    value={tsForm.name || ''}
                    onChange={(e) => setTsForm({ ...tsForm, name: e.target.value })}
                    placeholder="e.g. Primary Weather Station"
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Read API Key
                  </label>
                  <input
                    type="password"
                    value={tsForm.read_api_key || ''}
                    onChange={(e) => setTsForm({ ...tsForm, read_api_key: e.target.value })}
                    placeholder="Leave unchanged or enter new key"
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Required for private channels. Stored securely on the backend; never exposed to frontend clients.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Write API Key
                  </label>
                  <input
                    type="password"
                    value={tsForm.write_api_key || ''}
                    onChange={(e) => setTsForm({ ...tsForm, write_api_key: e.target.value })}
                    placeholder="Optional: for test publishing"
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Sync Polling Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="3600"
                    value={tsForm.sync_interval_seconds || 30}
                    onChange={(e) =>
                      setTsForm({ ...tsForm, sync_interval_seconds: parseInt(e.target.value) || 30 })
                    }
                    className="w-full bg-surface-elevated border border-surface-border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ThingSpeak free tiers require a minimum of 15 seconds between requests.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="tsEnabled"
                    checked={tsForm.is_active ?? true}
                    onChange={(e) => setTsForm({ ...tsForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-surface-elevated text-cyan-600 focus:ring-0"
                  />
                  <label htmlFor="tsEnabled" className="text-xs text-slate-200 cursor-pointer">
                    Enable Active ThingSpeak Poller & Ingestion Pipeline
                  </label>
                </div>
              </div>

              {/* Field Mapping Guide */}
              <div className="pt-4 border-t border-surface-border">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                  Standard Field Mappings
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field1</span>: Temp (°C)
                  </div>
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field2</span>: Humidity (%)
                  </div>
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field3</span>: Pressure (hPa)
                  </div>
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field4</span>: Wind (km/h)
                  </div>
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field5</span>: Rain (mm)
                  </div>
                  <div className="p-2 rounded-lg bg-surface-elevated border border-surface-border">
                    <span className="text-cyan-400 font-bold">field6</span>: Battery (V)
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition"
                >
                  <Save className="w-4 h-4" /> Save ThingSpeak Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Notifications Integration */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-400" />
              External Dispatch Channels
            </h3>
            <p className="text-xs text-slate-400">
              Configure downstream integration channels for verified critical weather alerts and system incidents.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">In-App Notification</div>
                  <div className="text-[11px] text-slate-400 font-sans">Bell drawer, audio cues & toasts</div>
                </div>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">Email Alerts (SMTP)</div>
                  <div className="text-[11px] text-slate-400 font-sans">Configurable in backend environment</div>
                </div>
                <span className="text-slate-500">OPTIONAL</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">Telegram Bot</div>
                  <div className="text-[11px] text-slate-400 font-sans">Instant push via Telegram Bot API</div>
                </div>
                <span className="text-slate-500">OPTIONAL</span>
              </div>
            </div>
          </div>

          {/* Test Notification Trigger */}
          <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary-400" />
              Integration Verification Test
            </h3>
            <p className="text-xs text-slate-400">
              Dispatch a test alert payload to confirm provider configuration without triggering false production incidents.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Channel</label>
                <select
                  value={testChannel}
                  onChange={(e: any) => setTestChannel(e.target.value)}
                  className="bg-surface-elevated border border-surface-border rounded-lg p-2 text-slate-200 w-full md:w-64"
                >
                  <option value="IN_APP">In-App Notification</option>
                  <option value="EMAIL">Email Dispatch</option>
                  <option value="TELEGRAM">Telegram Bot</option>
                </select>
              </div>

              <button
                onClick={handleTestNotification}
                disabled={isTestingNotif}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium flex items-center gap-2 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isTestingNotif ? 'Sending Test...' : 'Send Test Notification'}
              </button>

              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs font-mono mt-3 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/40 border-red-500/40 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{testResult.message || 'Notification delivered successfully.'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>Delivery Failed: {testResult.details || testResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General System Settings */}
      {activeTab === 'general' && (
        <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary-400" />
            Platform & Localization Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-2">
            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
              <span className="text-slate-400 font-sans">Unit System</span>
              <div className="text-slate-200 font-bold font-sans">Metric (°C, km/h, hPa, mm)</div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
              <span className="text-slate-400 font-sans">Primary Timezone</span>
              <div className="text-slate-200 font-bold font-sans">UTC / Local Browser Auto-detect</div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
              <span className="text-slate-400 font-sans">Device Timeout Threshold</span>
              <div className="text-slate-200 font-bold font-sans">Stale: 60s • Offline: 300s</div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border space-y-1">
              <span className="text-slate-400 font-sans">Default Retention Window</span>
              <div className="text-slate-200 font-bold font-sans">90 Days Active Telemetry</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Security, RBAC & Audit Log */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary-400" />
                  Role-Based Access Control (RBAC)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Current User: <strong className="text-primary-400">{user?.username}</strong> ({user?.role?.toUpperCase()})
                </p>
              </div>

              {/* Demo role switcher for testing */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-sans">Quick Switch:</span>
                <button
                  onClick={() => handleSwitchRole('admin')}
                  className={`px-2.5 py-1 rounded border text-xs font-mono ${
                    user?.role === 'admin'
                      ? 'bg-primary-600 text-white border-primary-500'
                      : 'bg-surface-elevated text-slate-300 border-surface-border'
                  }`}
                >
                  Admin
                </button>
                <button
                  onClick={() => handleSwitchRole('operator')}
                  className={`px-2.5 py-1 rounded border text-xs font-mono ${
                    user?.role === 'operator'
                      ? 'bg-primary-600 text-white border-primary-500'
                      : 'bg-surface-elevated text-slate-300 border-surface-border'
                  }`}
                >
                  Operator
                </button>
                <button
                  onClick={() => handleSwitchRole('viewer')}
                  className={`px-2.5 py-1 rounded border text-xs font-mono ${
                    user?.role === 'viewer'
                      ? 'bg-primary-600 text-white border-primary-500'
                      : 'bg-surface-elevated text-slate-300 border-surface-border'
                  }`}
                >
                  Viewer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
                <div className="font-semibold text-slate-200">Viewer</div>
                <div className="text-slate-400 text-[11px]">View dashboards, telemetry, events & export reports. Read-only.</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
                <div className="font-semibold text-slate-200">Operator</div>
                <div className="text-slate-400 text-[11px]">Acknowledge incidents, trigger simulator scenarios, calibrate offsets.</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
                <div className="font-semibold text-slate-200">Administrator</div>
                <div className="text-slate-400 text-[11px]">Full access: edit rules, provision devices, manage users & view audit log.</div>
              </div>
            </div>
          </div>

          {/* Audit Logs Table for Admin */}
          {isAdmin && (
            <div className="bg-surface rounded-2xl border border-surface-border p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary-400" />
                Immutable System Audit Trail
              </h3>
              <p className="text-xs text-slate-400">
                Chronological log of administrative actions, rule modifications, and credential operations.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/40">
                    {auditLogs && auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-surface-elevated/40 transition">
                          <td className="py-2 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                          <td className="py-2 px-3 text-primary-400">{log.username}</td>
                          <td className="py-2 px-3 text-slate-200 font-bold">{log.action}</td>
                          <td className="py-2 px-3 text-slate-300">{log.entity_type}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">{log.details}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                          No audit log entries recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-surface-border p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-slate-100 text-base mb-1">
              Edit Detection Rule: {editingRule.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Code: {editingRule.rule_code} • Metric: {editingRule.metric}
            </p>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1 font-sans font-medium">
                  Trigger Threshold ({editingRule.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(parseFloat(e.target.value))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-sans font-medium">
                  Recovery Threshold ({editingRule.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editRecovery}
                  onChange={(e) => setEditRecovery(parseFloat(e.target.value))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-sans font-medium">Severity Classification</label>
                <select
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value)}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2.5 text-sm text-slate-100"
                >
                  <option value="advisory">Advisory</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-sans font-medium">Cooldown Duration (Seconds)</label>
                <input
                  type="number"
                  required
                  value={editCooldown}
                  onChange={(e) => setEditCooldown(parseInt(e.target.value))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg p-2.5 text-sm text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ruleEnabled"
                  checked={editEnabled}
                  onChange={(e) => setEditEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-surface-elevated text-primary-600 focus:ring-0"
                />
                <label htmlFor="ruleEnabled" className="text-slate-300 font-sans cursor-pointer">
                  Rule Enabled & Active in Detection Pipeline
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 font-sans text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-sans font-medium text-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};