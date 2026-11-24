import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortal } from '../context/PortalContext';
import { hasPermission, isComplaintOverdue } from '../lib/rbac';

const REFERENCE_NOW = new Date('2026-11-24T09:15:00Z').getTime();

export const PerformancePage: React.FC = () => {
  const { currentUser, complaints, departments, officers } = usePortal();

  const metrics = useMemo(() => {
    const resolvedItems = complaints.filter((c) => c.status === 'Resolved' && c.resolvedAt);
    const avgResolutionHours =
      resolvedItems.length > 0
        ? Math.round(
            resolvedItems.reduce((sum, c) => {
              const start = new Date(c.reportedAt).getTime();
              const end = new Date(c.resolvedAt!).getTime();
              return sum + Math.max(1, (end - start) / (1000 * 60 * 60));
            }, 0) / resolvedItems.length
          )
        : 0;

    const total = complaints.length || 1;
    const resolutionRate = Math.round((resolvedItems.length / total) * 100);
    const overdueCount = complaints.filter((c) => isComplaintOverdue(c, REFERENCE_NOW)).length;
    const overduePct = Math.round((overdueCount / total) * 100);
    const slaCompliance = Math.max(0, 100 - overduePct);

    return { avgResolutionHours, resolutionRate, slaCompliance, overduePct };
  }, [complaints]);

  const deptPerformance = useMemo(() => {
    return departments.map((d) => {
      const items = complaints.filter((c) => c.assignedDepartmentId === d.id);
      const resolved = items.filter((c) => c.status === 'Resolved').length;
      const overdue = items.filter((c) => isComplaintOverdue(c, REFERENCE_NOW)).length;
      const rate = items.length > 0 ? Math.round((resolved / items.length) * 100) : 0;
      const sla =
        items.length > 0 ? Math.round(((items.length - overdue) / items.length) * 100) : 100;
      return {
        name: d.name,
        code: d.code,
        assigned: items.length,
        resolved,
        overdue,
        resolutionRate: rate,
        slaCompliance: sla,
      };
    });
  }, [departments, complaints]);

  const officerPerformance = useMemo(() => {
    return officers.map((o) => {
      const active = complaints.filter(
        (c) => c.assignedOfficerId === o.id && c.status !== 'Resolved' && c.status !== 'Rejected'
      ).length;
      return {
        ...o,
        active,
        deptName: departments.find((d) => d.id === o.departmentId)?.name || '—',
      };
    });
  }, [officers, complaints, departments]);

  if (!currentUser || !hasPermission(currentUser.role, 'view_performance')) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-8 text-center">
        <h2 className="text-sm font-semibold text-[#1E293B]">Access Restricted</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Performance monitoring is restricted to administrative and supervisory staff.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1440px]">
      <div>
        <h2 className="text-lg font-semibold text-[#1E293B]">Performance Monitoring</h2>
        <p className="text-xs text-[#64748B]">
          Resolution turnaround benchmarks, SLA compliance rates, and officer caseload efficiency
        </p>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="px-4 py-3.5">
          <div className="text-xs text-[#64748B]">Avg. Resolution Time</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#1E293B]">
            {metrics.avgResolutionHours} hrs
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-xs text-[#64748B]">Department Resolution Rate</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#0044B3]">
            {metrics.resolutionRate}%
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-xs text-[#64748B]">SLA Compliance</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#10B981]">
            {metrics.slaCompliance}%
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-xs text-[#64748B]">Overdue Complaint Rate</div>
          <div className="mt-1 font-mono-tabular text-2xl font-semibold text-[#EF4444]">
            {metrics.overduePct}%
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-4 lg:col-span-6">
          <h3 className="text-sm font-semibold text-[#1E293B]">SLA Compliance by Department (%)</h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptPerformance} margin={{ top: 8, right: 12, left: -16, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="slaCompliance" name="SLA Compliance %" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-6">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">Department SLA Scorecard</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5 text-right">Assigned</th>
                  <th className="px-4 py-2.5 text-right">Resolved</th>
                  <th className="px-4 py-2.5 text-right">Overdue</th>
                  <th className="px-4 py-2.5 text-right">SLA %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {deptPerformance.map((d) => (
                  <tr key={d.code} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-2.5 font-medium text-[#1E293B]">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular">{d.assigned}</td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-[#10B981]">
                      {d.resolved}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular text-[#EF4444]">
                      {d.overdue}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-[#1E293B]">
                      {d.slaCompliance}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Officer Workload Table */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-[#E2E8F0] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#1E293B]">Officer Workload & Completions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Officer</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5 text-right">Active Cases</th>
                <th className="px-4 py-2.5 text-right">Completed</th>
                <th className="px-4 py-2.5">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {officerPerformance.map((o) => (
                <tr key={o.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2.5 font-medium text-[#1E293B]">
                    {o.name}{' '}
                    <span className="font-mono-tabular text-[11px] text-[#64748B]">
                      ({o.employeeId})
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#64748B]">{o.deptName}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{o.wardJurisdiction}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-[#0044B3]">
                    {o.active}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-[#10B981]">
                    {o.completedComplaints}
                  </td>
                  <td className="px-4 py-2.5 text-[#1E293B]">{o.availability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
