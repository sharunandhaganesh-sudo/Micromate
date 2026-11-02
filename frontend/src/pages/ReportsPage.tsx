import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet, Download, Printer, Plus, Calendar, CheckCircle2,
  Clock, ShieldAlert, FileText, Info
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulator } from '../context/SimulatorContext';

export const ReportsPage: React.FC = () => {
  const { selectedStationId, stations } = useSimulator();

  const [reportType, setReportType] = useState('daily_summary');
  const [daysBack, setDaysBack] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);

  // Query existing reports
  const { data: reportJobs, refetch } = useQuery({
    queryKey: ['report-jobs'],
    queryFn: () => api.getReports(),
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStationId) return;
    setIsGenerating(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const res = await api.generateReport({
        station_id: selectedStationId,
        report_type: reportType,
        format: 'json',
        date_from: from.toISOString(),
        date_to: now.toISOString(),
      });
      setGeneratedReport(res.summary);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border/60 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Microclimate Reports & Observational Summaries
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Generate formal meteorological summaries, uptime calculations, and data completeness audits.
          </p>
        </div>

        {generatedReport && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border hover:bg-slate-700 text-xs text-slate-200 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Report Generator Form */}
      <div className="bg-surface rounded-2xl border border-surface-border p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-400" />
          Generate New Observation Summary
        </h3>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">Station</label>
            <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-slate-200 font-medium truncate">
              {selectedStation?.name || 'Ridgecrest Observatory'}
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-slate-100 focus:border-primary-500 focus:outline-none"
            >
              <option value="daily_summary">Daily Weather Summary</option>
              <option value="weekly_summary">Weekly Monitoring Report</option>
              <option value="monthly_monitoring">Monthly Microclimate Audit</option>
              <option value="event_summary">Extreme Event Log</option>
              <option value="uptime_report">Station Uptime & Completeness</option>
              <option value="data_quality">Sensor Data Quality Audit</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Period Window</label>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-slate-100 focus:border-primary-500 focus:outline-none"
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-2 px-4 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white font-medium transition"
          >
            {isGenerating ? 'Computing...' : 'Generate Report'}
          </button>
        </form>
      </div>

      {/* Active Generated Report View */}
      {generatedReport && (
        <div className="bg-surface rounded-2xl border border-surface-border p-6 space-y-6 shadow-xl print:bg-white print:text-black">
          {/* Official Document Header */}
          <div className="pb-4 border-b border-surface-border flex flex-wrap justify-between items-start gap-4">
            <div>
              <span className="text-[10px] text-primary-400 font-mono uppercase tracking-wider block">
                Official Station Report
              </span>
              <h2 className="text-xl font-bold text-white uppercase tracking-tight mt-0.5">
                {generatedReport.report_type.replace(/_/g, ' ')}
              </h2>
              <div className="text-xs text-slate-400 font-mono mt-1">
                Station: {generatedReport.station_name} ({generatedReport.station_code}) • {generatedReport.location}
              </div>
            </div>

            <div className="text-right text-xs font-mono text-slate-400">
              <div>Window: {new Date(generatedReport.date_from).toLocaleDateString()} — {new Date(generatedReport.date_to).toLocaleDateString()}</div>
              <div className="text-[11px] text-slate-500 mt-1">Completeness: <strong className="text-emerald-400">{generatedReport.data_completeness_pct}%</strong></div>
            </div>
          </div>

          {/* Key Metrics Table */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
              <span className="text-slate-500 text-[10px] uppercase block font-sans">Temperature</span>
              <div className="text-xl font-bold text-white mt-1">
                {generatedReport.temperature?.avg_c ?? '--'} °C
              </div>
              <div className="text-slate-400 text-[10px] mt-1">
                Min: {generatedReport.temperature?.min_c ?? '--'}° | Max: {generatedReport.temperature?.max_c ?? '--'}°
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
              <span className="text-slate-500 text-[10px] uppercase block font-sans">Relative Humidity</span>
              <div className="text-xl font-bold text-white mt-1">
                {generatedReport.humidity?.avg_pct ?? '--'} %
              </div>
              <div className="text-slate-400 text-[10px] mt-1">
                Min: {generatedReport.humidity?.min_pct ?? '--'}% | Max: {generatedReport.humidity?.max_pct ?? '--'}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
              <span className="text-slate-500 text-[10px] uppercase block font-sans">Atmospheric Pressure</span>
              <div className="text-xl font-bold text-white mt-1">
                {generatedReport.pressure?.avg_hpa ?? '--'} hPa
              </div>
              <div className="text-slate-400 text-[10px] mt-1">
                Min: {generatedReport.pressure?.min_hpa ?? '--'} | Max: {generatedReport.pressure?.max_hpa ?? '--'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-border">
              <span className="text-slate-500 text-[10px] uppercase block font-sans">Total Precipitation</span>
              <div className="text-xl font-bold text-white mt-1">
                {generatedReport.rainfall?.total_mm ?? '0.0'} mm
              </div>
              <div className="text-slate-400 text-[10px] mt-1">
                Total Bucket Tips: {generatedReport.rainfall?.interval_count ?? 0}
              </div>
            </div>
          </div>

          {/* Scientific Disclaimer & Metadata */}
          <div className="p-4 rounded-xl bg-surface-elevated/60 border border-slate-700/60 text-xs text-slate-400 leading-relaxed font-sans space-y-1.5">
            <div className="font-semibold text-slate-300">Methodology & Durability Limitations:</div>
            <p>
              {generatedReport.limitations_note} Data completeness is calculated against the theoretical expectation of 1 sample per minute. Extreme event detection thresholds are configured experimentally and must not be used as official government meteorological advisories.
            </p>
          </div>
        </div>
      )}

      {/* Generated Report Archives History Table */}
      <div className="bg-surface rounded-2xl border border-surface-border p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">
          Archived Reports History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-surface-border text-slate-400 text-[11px] uppercase">
                <th className="py-2.5 px-3">Report ID</th>
                <th className="py-2.5 px-3">Station</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Date Window</th>
                <th className="py-2.5 px-3">Generated</th>
                <th className="py-2.5 px-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40">
              {reportJobs && reportJobs.length > 0 ? (
                reportJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-surface-elevated/40 transition">
                    <td className="py-2.5 px-3 text-primary-400">{j.id.slice(0, 8)}...</td>
                    <td className="py-2.5 px-3 text-slate-200 font-sans">{j.station_name || 'Ridgecrest Observatory'}</td>
                    <td className="py-2.5 px-3 uppercase text-slate-300">{j.report_type.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(j.date_from).toLocaleDateString()} — {new Date(j.date_to).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{new Date(j.created_at).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <a
                        href={`/api/v1/reports/${j.id}/download?format=csv`}
                        className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 font-sans font-medium"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No reports generated yet. Click Generate Report above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
