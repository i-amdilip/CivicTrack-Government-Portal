import React, { useMemo, useState } from 'react';
import { BrainCircuit, Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortal } from '../context/PortalContext';
import { hasPermission, isComplaintOverdue } from '../lib/rbac';
import type { OperationalBriefingResult } from '../types/civic';
import { exportToCsv } from '../utils/csvExport';

const REFERENCE_NOW = new Date('2026-11-24T09:15:00Z').getTime();

export const AnalyticsPage: React.FC = () => {
  const { currentUser, complaints, departments, requestOperationalBriefing } = usePortal();
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('All');

  // Complex Operational Query (Thinking Mode)
  const [queryText, setQueryText] = useState(
    'Identify the highest-risk SLA bottlenecks across wards and recommend cross-department resource adjustments.'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [briefing, setBriefing] = useState<OperationalBriefingResult | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const cutoff =
      dateFilter === 'all'
        ? 0
        : REFERENCE_NOW - (dateFilter === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;

    return complaints.filter((c) => {
      if (cutoff && new Date(c.reportedAt).getTime() < cutoff) return false;
      if (deptFilter !== 'All' && c.assignedDepartmentId !== deptFilter) return false;
      return true;
    });
  }, [complaints, dateFilter, deptFilter]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      map[c.category] = (map[c.category] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      map[c.status] = (map[c.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const byWard = useMemo(() => {
    const map: Record<string, { total: number; critical: number; overdue: number }> = {};
    filtered.forEach((c) => {
      if (!map[c.ward]) map[c.ward] = { total: 0, critical: 0, overdue: 0 };
      map[c.ward].total += 1;
      if (c.priority === 'Critical') map[c.ward].critical += 1;
      if (isComplaintOverdue(c, REFERENCE_NOW)) map[c.ward].overdue += 1;
    });
    return Object.entries(map)
      .map(([ward, d]) => ({
        ward,
        ...d,
        sharePct: filtered.length > 0 ? Math.round((d.total / filtered.length) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const overTime = useMemo(() => {
    const dateCounts: Record<string, { date: string; submitted: number; resolved: number }> = {};
    filtered.forEach((c) => {
      const day = c.reportedAt.slice(5, 10);
      if (!dateCounts[day]) dateCounts[day] = { date: day, submitted: 0, resolved: 0 };
      dateCounts[day].submitted += 1;
      if (c.status === 'Resolved') dateCounts[day].resolved += 1;
    });
    return Object.values(dateCounts).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  if (!currentUser || !hasPermission(currentUser.role, 'view_analytics')) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-8 text-center">
        <h2 className="text-sm font-semibold text-[#1E293B]">Access Restricted</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Analytics & Reports are restricted to authorized supervisory and administrative officials.
        </p>
      </div>
    );
  }

  const handleExport = () => {
    exportToCsv(
      'civictrack-analytics-report.csv',
      ['Ward', 'Total Complaints', 'Critical Issues', 'Overdue SLA', 'Share %'],
      byWard.map((w) => [w.ward, w.total, w.critical, w.overdue, `${w.sharePct}%`])
    );
  };

  const handleBriefingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setBriefingError(null);
    try {
      const res = await requestOperationalBriefing({ query: queryText });
      setBriefing(res);
    } catch (err: unknown) {
      setBriefingError(err instanceof Error ? err.message : 'Unable to generate operational report.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1440px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">Analytics & Reports</h2>
          <p className="text-xs text-[#64748B]">
            Complaint distributions, temporal volume, geographic ward concentration, and CSV export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Date range filter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as '7d' | '30d' | 'all')}
            className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Recorded</option>
          </select>
          <select
            aria-label="Department filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {hasPermission(currentUser.role, 'export_reports') && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC]"
            >
              <Download className="h-3.5 w-3.5 text-[#64748B]" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Complaints by Category */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B]">Complaints by Category</h3>
          <p className="text-xs text-[#64748B] mb-3">Total submissions grouped by civic domain</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ top: 8, right: 12, left: -16, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Complaints" fill="#0044B3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Complaints by Status */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B]">Complaints by Status</h3>
          <p className="text-xs text-[#64748B] mb-3">Current workflow stage breakdown</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ top: 8, right: 12, left: -16, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Records" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Complaints Over Time */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-4">
          <h3 className="text-sm font-semibold text-[#1E293B]">Complaints Over Time</h3>
          <p className="text-xs text-[#64748B] mb-3">Daily submission vs. closure volume</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overTime} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#0044B3" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Geographic Ward Concentration Table */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">
              Geographic Analytics — High-Complaint Wards
            </h3>
            <p className="text-xs text-[#64748B]">
              Complaint density and SLA breach incidence across municipal wards
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                  <th className="px-4 py-2.5">Ward</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Critical</th>
                  <th className="px-4 py-2.5 text-right">Overdue</th>
                  <th className="px-4 py-2.5 w-32">Density Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {byWard.map((w) => (
                  <tr key={w.ward} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-2.5 font-medium text-[#1E293B]">{w.ward}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular">{w.total}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-[#F59E0B]">
                      {w.critical}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono-tabular ${
                        w.overdue > 0 ? 'font-semibold text-[#EF4444]' : 'text-[#64748B]'
                      }`}
                    >
                      {w.overdue}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-sm bg-[#E2E8F0]">
                          <div
                            className="h-full bg-[#0044B3]"
                            style={{ width: `${w.sharePct}%` }}
                          />
                        </div>
                        <span className="font-mono-tabular text-[11px] text-[#64748B]">
                          {w.sharePct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* High-Thinking Operational Analysis Query */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-[#0044B3]" />
          <h3 className="text-sm font-semibold text-[#1E293B]">
            Municipal Operations Briefing (Deep Analysis)
          </h3>
        </div>
        <form onSubmit={handleBriefingSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Ask a complex operational or resource allocation question..."
            className="flex-1 rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAnalyzing}
            className="shrink-0 rounded bg-[#0044B3] px-4 py-2 text-xs font-medium text-white hover:bg-[#003591] disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing Operations...' : 'Run Briefing'}
          </button>
        </form>

        {briefingError && (
          <div className="rounded border border-[#F4C2C2] bg-[#FEF0F0] p-3 text-xs text-[#EF4444]">
            {briefingError}
          </div>
        )}

        {briefing && (
          <div className="grid grid-cols-1 gap-4 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-4 md:grid-cols-2 text-xs">
            <div className="space-y-2">
              <div>
                <div className="font-semibold text-[#1E293B]">Executive Summary</div>
                <p className="mt-0.5 text-[#64748B]">{briefing.summary}</p>
              </div>
              <div>
                <div className="font-semibold text-[#1E293B]">Root-Cause Assessment</div>
                <p className="mt-0.5 text-[#64748B]">{briefing.rootCauseAssessment}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <div className="font-semibold text-[#1E293B]">SLA Risk Assessment</div>
                <p className="mt-0.5 text-[#64748B]">{briefing.slaRiskAssessment}</p>
              </div>
              {briefing.recommendedActions?.length > 0 && (
                <div>
                  <div className="font-semibold text-[#1E293B]">Recommended Actions</div>
                  <ul className="mt-1 list-disc pl-4 text-[#1E293B] space-y-0.5">
                    {briefing.recommendedActions.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-[11px] text-[#64748B] pt-1">{briefing.advisoryNotice}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
