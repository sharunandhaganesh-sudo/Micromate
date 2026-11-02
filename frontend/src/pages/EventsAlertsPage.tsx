import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Filter,
  Clock, Check, Search, FileText, ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Incident } from '../types';

export const EventsAlertsPage: React.FC = () => {
  const { selectedStationId } = useSimulator();

  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'real' | 'simulated'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [resolveNotes, setResolveNotes] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [showActionModal, setShowActionModal] = useState<'resolve' | 'dismiss' | null>(null);

  const { data: incidents, refetch } = useQuery({
    queryKey: ['incidents', selectedStationId, statusFilter, severityFilter, eventTypeFilter],
    queryFn: () =>
      api.getIncidents({
        station_id: selectedStationId || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        event_type: eventTypeFilter || undefined,
      }),
    refetchInterval: 5000,
  });

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeIncident(id, 'Current Operator');
      refetch();
    } catch (e: any) {
      alert(e.message || 'Failed to acknowledge incident');
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident) return;
    try {
      await api.resolveIncident(selectedIncident.id, resolveNotes);
      setShowActionModal(null);
      setResolveNotes('');
      refetch();
    } catch (e: any) {
      alert(e.message || 'Failed to resolve incident');
    }
  };

  const handleDismiss = async () => {
    if (!selectedIncident || !dismissReason) return;
    try {
      await api.dismissIncident(selectedIncident.id, dismissReason);
      setShowActionModal(null);
      setDismissReason('');
      refetch();
    } catch (e: any) {
      alert(e.message || 'Failed to dismiss incident');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-navy-900 tracking-tight">
            Weather Alerts & Incidents
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Extreme weather event detection, sensor evidence tracking, and alert lifecycle management for Ridgecrest Observatory.
          </p>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white rounded-2xl border border-surface-border p-4 flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs shadow-card">
        <span className="text-navy-700 font-bold flex items-center gap-1.5 font-mono whitespace-nowrap">
          <Filter className="w-3.5 h-3.5 text-primary-600" /> Filters:
        </span>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 text-navy-800 border border-surface-border rounded-xl px-3 py-1.5 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none cursor-pointer"
        >
          <option value="ACTIVE">Active Incidents Only</option>
          <option value="">All Statuses (History)</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>

        {/* Source Filter (Real vs Simulated) */}
        <select
          value={sourceFilter}
          onChange={(e: any) => setSourceFilter(e.target.value)}
          className="bg-slate-50 text-navy-800 border border-surface-border rounded-xl px-3 py-1.5 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none cursor-pointer"
        >
          <option value="all">All Sources</option>
          <option value="real">Real Hardware (ESP32 / ThingSpeak)</option>
          <option value="simulated">Simulated Demo Only</option>
        </select>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-slate-50 text-navy-800 border border-surface-border rounded-xl px-3 py-1.5 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none cursor-pointer"
        >
          <option value="">All Severities</option>
          <option value="advisory">Advisory</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>

        {/* Event Type Filter */}
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="bg-slate-50 text-navy-800 border border-surface-border rounded-xl px-3 py-1.5 font-medium focus:ring-1 focus:ring-primary-500 focus:outline-none cursor-pointer"
        >
          <option value="">All Anomaly Types</option>
          <option value="HEAVY_RAIN">HEAVY_RAIN</option>
          <option value="HIGH_RAIN_RATE">HIGH_RAIN_RATE</option>
          <option value="STRONG_WIND">STRONG_WIND</option>
          <option value="HIGH_TEMPERATURE">HIGH_TEMPERATURE</option>
          <option value="RAPID_PRESSURE_DECLINE">RAPID_PRESSURE_DECLINE</option>
          <option value="SENSOR_MALFUNCTION">SENSOR_MALFUNCTION</option>
        </select>

        {(statusFilter || severityFilter || eventTypeFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setSeverityFilter('');
              setEventTypeFilter('');
            }}
            className="text-primary-600 hover:text-primary-700 font-bold ml-auto cursor-pointer whitespace-nowrap"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Incidents Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-3">
          {incidents && incidents.filter(inc => {
            if (sourceFilter === 'real') return !inc.is_simulated;
            if (sourceFilter === 'simulated') return inc.is_simulated;
            return true;
          }).length > 0 ? (
            incidents
              .filter(inc => {
                if (sourceFilter === 'real') return !inc.is_simulated;
                if (sourceFilter === 'simulated') return inc.is_simulated;
                return true;
              })
              .map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-3 shadow-card ${
                  selectedIncident?.id === inc.id
                    ? 'bg-primary-50/50 border-primary-500 ring-2 ring-primary-500/20'
                    : 'bg-white border-surface-border hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inc.severity} size="sm" />
                      <span className="font-bold text-sm text-navy-900 font-mono">
                        {inc.event_type}
                      </span>
                      {inc.is_simulated ? (
                        <span className="text-[10px] text-amber-800 font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                          SIMULATED
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-800 font-mono font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                          FIELD REAL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-600 leading-relaxed font-sans">
                      {inc.evidence_summary || 'Configured threshold condition triggered.'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <StatusBadge status={inc.status} size="sm" showDot={false} />
                    <div className="text-[11px] font-mono text-navy-400 mt-1 font-medium">
                      {new Date(inc.last_occurrence).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Inline Action Triggers with clear high-contrast text */}
                <div className="flex items-center justify-between pt-2 border-t border-surface-border text-xs font-mono">
                  <span className="text-navy-500 text-[11px]">
                    Measured: <strong>{inc.triggering_value ?? '--'}</strong> vs Threshold: <strong>{inc.threshold_value ?? '--'}</strong>
                  </span>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {inc.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleAcknowledge(inc.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 transition cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}

                    {['ACTIVE', 'ACKNOWLEDGED'].includes(inc.status) && (
                      <button
                        onClick={() => {
                          setSelectedIncident(inc);
                          setShowActionModal('resolve');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition cursor-pointer"
                      >
                        Resolve Alert
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl border border-surface-border p-12 text-center text-xs text-navy-400 shadow-card">
              No matching incidents found for the selected filters.
            </div>
          )}
        </div>

        {/* Incident Evidence Detail Inspector */}
        <div className="space-y-4">
          {selectedIncident ? (
            <div className="bg-white rounded-2xl border border-surface-border p-5 space-y-4 sticky top-20 shadow-card">
              <div className="flex items-start justify-between pb-3 border-b border-surface-border">
                <div>
                  <span className="text-[10px] text-navy-400 font-mono uppercase font-bold">Forensic Evidence Chain</span>
                  <h3 className="font-bold text-navy-900 text-sm mt-0.5 font-mono">{selectedIncident.event_type}</h3>
                </div>
                <StatusBadge status={selectedIncident.severity} size="sm" />
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-50 border border-surface-border">
                  <span className="text-navy-400 text-[10px] block uppercase font-sans font-bold">Triggering Observation</span>
                  <div className="text-navy-900 mt-1 font-bold text-sm">
                    {selectedIncident.triggering_value ?? '--'} <span className="text-xs text-navy-500 font-normal">vs rule threshold: {selectedIncident.threshold_value ?? '--'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-surface-border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-navy-500 font-sans">Start Timestamp:</span>
                    <span className="text-navy-800 font-bold">{new Date(selectedIncident.start_time).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-navy-500 font-sans">Last Observed:</span>
                    <span className="text-navy-800 font-bold">{new Date(selectedIncident.last_occurrence).toLocaleTimeString()}</span>
                  </div>
                  {selectedIncident.resolved_at && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-sans">Resolved At:</span>
                      <span className="font-bold">{new Date(selectedIncident.resolved_at).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {selectedIncident.acknowledged_by && (
                    <div className="flex justify-between text-amber-700">
                      <span className="font-sans">Ack By:</span>
                      <span className="font-bold">{selectedIncident.acknowledged_by}</span>
                    </div>
                  )}
                </div>

                {selectedIncident.resolution_notes && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-sans">
                    <strong>Resolution Notes:</strong> {selectedIncident.resolution_notes}
                  </div>
                )}

                {selectedIncident.dismissal_reason && (
                  <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-navy-700 text-xs font-sans">
                    <strong>Dismissal Reason:</strong> {selectedIncident.dismissal_reason}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-surface-border flex gap-2">
                {['ACTIVE', 'ACKNOWLEDGED'].includes(selectedIncident.status) && (
                  <>
                    <button
                      onClick={() => setShowActionModal('resolve')}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      Resolve Incident
                    </button>
                    <button
                      onClick={() => setShowActionModal('dismiss')}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy-700 text-xs font-bold border border-slate-200 transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-surface-border p-8 text-center text-navy-400 text-xs shadow-card">
              Select an incident from the list to inspect forensic sensor evidence and execution timeline.
            </div>
          )}
        </div>
      </div>

      {/* Action Dialog (Resolve / Dismiss) */}
      {showActionModal && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-surface-border p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-navy-900 text-base mb-2">
              {showActionModal === 'resolve' ? 'Resolve Weather Incident' : 'Dismiss False Positive'}
            </h3>
            <p className="text-xs text-navy-600 mb-4">
              {showActionModal === 'resolve'
                ? `Mark ${selectedIncident.event_type} as resolved with post-incident maintenance notes.`
                : `Dismiss ${selectedIncident.event_type} if triggered by sensor testing or calibration artifact.`}
            </p>

            {showActionModal === 'resolve' ? (
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="e.g. Field inspection completed. Weather stabilized and instruments checked."
                className="w-full bg-slate-50 border border-surface-border rounded-xl p-3 text-sm text-navy-900 h-28 focus:border-primary-500 focus:outline-none"
              />
            ) : (
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. Sensor bench test pulse or artificial calibration run."
                className="w-full bg-slate-50 border border-surface-border rounded-xl p-3 text-sm text-navy-900 h-28 focus:border-primary-500 focus:outline-none"
              />
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowActionModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy-700 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={showActionModal === 'resolve' ? handleResolve : handleDismiss}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition cursor-pointer shadow-xs ${
                  showActionModal === 'resolve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-navy-900 hover:bg-navy-800'
                }`}
              >
                Confirm {showActionModal === 'resolve' ? 'Resolution' : 'Dismissal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
