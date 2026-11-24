import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PriorityLabel, StatusLabel, formatDateTime, formatShortDate } from '../components/StatusLabels';
import { usePortal } from '../context/PortalContext';
import { formatTimeRemaining, hasPermission, isComplaintOverdue } from '../lib/rbac';
import type { ComplaintCategory, ComplaintStatus } from '../types/civic';

type DateRangeOption = '7d' | '30d' | '90d' | 'all';

const REFERENCE_NOW = new Date('2026-11-24T09:15:00Z').getTime();

const CATEGORY_BAR_COLORS = [
  '#0044B3',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#6366F1',
  '#EC4899',
];

export const DashboardPage: React.FC = () => {
  const { currentUser, complaints, departments, officers, activityLogs } = usePortal();
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | 'All'>('All');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [attentionTab, setAttentionTab] = useState<'alerts' | 'overdue' | 'activity'>('alerts');
  const [opsTab, setOpsTab] = useState<'workload' | 'unassigned' | 'high_priority'>('workload');
  const pageSize = 5;

  const periodLabel = useMemo(() => {
    if (dateRange === '7d') return 'Last 7 days';
    if (dateRange === '30d') return 'Last 30 days';
    if (dateRange === '90d') return 'Quarter to date';
    return 'All recorded';
  }, [dateRange]);

  const rangeFilteredComplaints = useMemo(() => {
    if (dateRange === 'all') return complaints;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = REFERENCE_NOW - days * 24 * 60 * 60 * 1000;
    return complaints.filter((c) => new Date(c.reportedAt).getTime() >= cutoff);
  }, [complaints, dateRange]);

  const stats = useMemo(() => {
    const todayPrefix = '2026-11-24';
    const total = rangeFilteredComplaints.length;
    const newToday = rangeFilteredComplaints.filter((c) =>
      c.reportedAt.startsWith(todayPrefix)
    ).length;
    const pending = rangeFilteredComplaints.filter(
      (c) => c.status === 'New' || c.status === 'Reviewed' || c.status === 'Pending'
    ).length;
    const inProgress = rangeFilteredComplaints.filter(
      (c) => c.status === 'In Progress' || c.status === 'Resolution Submitted'
    ).length;
    const resolved = rangeFilteredComplaints.filter((c) => c.status === 'Resolved').length;
    const slaBreaches = rangeFilteredComplaints.filter((c) =>
      isComplaintOverdue(c, REFERENCE_NOW)
    ).length;

    const pendingShare = total > 0 ? Math.round((pending / total) * 100) : 0;
    const inProgressShare = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const resolvedShare = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      newToday,
      pending,
      inProgress,
      resolved,
      slaBreaches,
      pendingShare,
      inProgressShare,
      resolvedShare,
    };
  }, [rangeFilteredComplaints]);

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])),
    [departments]
  );
  const officerMap = useMemo(
    () => Object.fromEntries(officers.map((o) => [o.id, o])),
    [officers]
  );

  const filteredTableComplaints = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return rangeFilteredComplaints
      .filter((c) => {
        if (statusFilter !== 'All' && c.status !== statusFilter) return false;
        if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.ward.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const diff = new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [rangeFilteredComplaints, tableSearch, statusFilter, categoryFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredTableComplaints.length / pageSize));
  const pagedComplaints = filteredTableComplaints.slice((page - 1) * pageSize, page * pageSize);

  const categoryBreakdown = useMemo(() => {
    const categories: ComplaintCategory[] = [
      'Road Maintenance',
      'Sanitation',
      'Water Supply',
      'Electricity',
      'Drainage',
      'Public Infrastructure',
    ];
    const total = rangeFilteredComplaints.length;
    return categories
      .map((category, idx) => {
        const count = rangeFilteredComplaints.filter((c) => c.category === category).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return {
          category,
          count,
          pct,
          color: CATEGORY_BAR_COLORS[idx % CATEGORY_BAR_COLORS.length],
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [rangeFilteredComplaints]);

  const highPriorityIssues = useMemo(() => {
    return rangeFilteredComplaints.filter(
      (c) =>
        (c.priority === 'Critical' || c.priority === 'High') &&
        c.status !== 'Resolved' &&
        c.status !== 'Rejected'
    );
  }, [rangeFilteredComplaints]);

  const awaitingAssignment = useMemo(() => {
    return rangeFilteredComplaints.filter(
      (c) => !c.assignedDepartmentId && c.status !== 'Resolved' && c.status !== 'Rejected'
    );
  }, [rangeFilteredComplaints]);

  const departmentWorkload = useMemo(() => {
    return departments.map((d) => {
      const items = rangeFilteredComplaints.filter((c) => c.assignedDepartmentId === d.id);
      const activeCount = items.filter(
        (c) => c.status === 'Pending' || c.status === 'In Progress' || c.status === 'Escalated'
      ).length;
      const resolvedCount = items.filter((c) => c.status === 'Resolved').length;
      const overdueCount = items.filter((c) => isComplaintOverdue(c, REFERENCE_NOW)).length;
      return {
        department: d,
        total: items.length,
        active: activeCount,
        resolved: resolvedCount,
        overdue: overdueCount,
      };
    });
  }, [departments, rangeFilteredComplaints]);

  const overdueComplaints = useMemo(() => {
    return rangeFilteredComplaints.filter((c) => isComplaintOverdue(c, REFERENCE_NOW));
  }, [rangeFilteredComplaints]);

  const criticalAlerts = useMemo(() => {
    return rangeFilteredComplaints.filter(
      (c) =>
        (c.status === 'Escalated' || c.priority === 'Critical') &&
        c.status !== 'Resolved' &&
        c.status !== 'Rejected'
    );
  }, [rangeFilteredComplaints]);

  const performanceTrend = useMemo(
    () => [
      { day: 'Nov 18', reported: 3, resolved: 1 },
      { day: 'Nov 19', reported: 2, resolved: 2 },
      { day: 'Nov 20', reported: 4, resolved: 2 },
      { day: 'Nov 21', reported: 3, resolved: 1 },
      { day: 'Nov 22', reported: 5, resolved: 3 },
      { day: 'Nov 23', reported: 4, resolved: 2 },
      { day: 'Nov 24', reported: 5, resolved: 3 },
    ],
    []
  );

  const slaComplianceRate = useMemo(() => {
    if (rangeFilteredComplaints.length === 0) return 100;
    const breached = rangeFilteredComplaints.filter((c) =>
      isComplaintOverdue(c, REFERENCE_NOW)
    ).length;
    return Math.round(
      ((rangeFilteredComplaints.length - breached) / rangeFilteredComplaints.length) * 100
    );
  }, [rangeFilteredComplaints]);

  const canAssign = currentUser ? hasPermission(currentUser.role, 'assign_complaint') : false;

  // SVG Ring Geometry for Service Level Gauge
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (slaComplianceRate / 100) * ringCircumference;

  return (
    <div className="space-y-6">
      {/* 1. Greeting & Scope Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1E293B]">
            Good morning, {currentUser?.name || 'Official'}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-[#64748B]">
            Real-time overview of civic complaints, SLA compliance, and municipal field operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 shadow-2xs">
            <label htmlFor="dashboard-date-range" className="text-xs font-medium text-[#64748B]">
              Period:
            </label>
            <select
              id="dashboard-date-range"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as DateRangeOption);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-[#1E293B] focus:outline-none"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Quarter to Date</option>
              <option value="all">All Recorded</option>
            </select>
          </div>
          {canAssign && awaitingAssignment.length > 0 && (
            <Link
              to="/assign"
              className="rounded-xl bg-[#0044B3] px-4 py-2 text-xs font-semibold text-white hover:bg-[#003591] whitespace-nowrap transition-colors shadow-2xs"
            >
              Assign Unassigned ({awaitingAssignment.length})
            </Link>
          )}
        </div>
      </div>

      {/* 2. Unified Hero Summary + Total Complaints Trend Card */}
      <section
        aria-label="Operational Summary and Trend"
        className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden"
      >
        {/* Top 5-Column KPI & Service Level Gauge Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-[#E2E8F0]">
          {/* Pending */}
          <Link
            to="/complaints/pending"
            className="group flex flex-col justify-between p-5 hover:bg-[#F8FAFC] transition-colors"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#10B981]">
                <Clock className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold text-[#1E293B] group-hover:text-[#0044B3]">
                Pending
              </div>
              <div className="text-xs text-[#64748B]">{periodLabel}</div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-tabular text-3xl font-bold text-[#1E293B]">
                  {stats.pending}
                </span>
                <span className="text-xs font-semibold text-[#D97706] tabular-nums">
                  {stats.pendingShare}% share
                </span>
              </div>
              <div className="mt-3 h-[3px] w-16 rounded-full bg-[#0044B3]" />
            </div>
          </Link>

          {/* In Progress */}
          <Link
            to="/complaints/in-progress"
            className="group flex flex-col justify-between p-5 hover:bg-[#F8FAFC] transition-colors"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#0044B3]">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold text-[#1E293B] group-hover:text-[#0044B3]">
                In Progress
              </div>
              <div className="text-xs text-[#64748B]">{periodLabel}</div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-tabular text-3xl font-bold text-[#1E293B]">
                  {stats.inProgress}
                </span>
                <span className="text-xs font-semibold text-[#0284C7] tabular-nums">
                  {stats.inProgressShare}% share
                </span>
              </div>
              <div className="mt-3 h-[3px] w-16 rounded-full bg-[#0EA5E9]" />
            </div>
          </Link>

          {/* Resolved / Solved */}
          <Link
            to="/complaints/resolved"
            className="group flex flex-col justify-between p-5 hover:bg-[#F8FAFC] transition-colors"
          >
            <div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFBEB] text-[#F59E0B]">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold text-[#1E293B] group-hover:text-[#0044B3]">
                Resolved
              </div>
              <div className="text-xs text-[#64748B]">{periodLabel}</div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono-tabular text-3xl font-bold text-[#1E293B]">
                  {stats.resolved}
                </span>
                <span className="text-xs font-semibold text-[#10B981] tabular-nums">
                  {stats.resolvedShare}% closed
                </span>
              </div>
              <div className="mt-3 h-[3px] w-16 rounded-full bg-[#F59E0B]" />
            </div>
          </Link>

          {/* Circular Service Level Gauge */}
          <Link
            to="/performance"
            className="flex flex-col items-center justify-center p-5 hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="relative flex h-28 w-28 items-center justify-center">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                <circle
                  cx="56"
                  cy="56"
                  r={ringRadius}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="8"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={ringRadius}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold text-[#64748B]">Service Level</span>
                <span className="font-mono-tabular text-xl font-bold text-[#1E293B] leading-tight">
                  {slaComplianceRate}%
                </span>
                <span className="text-[10px] text-[#64748B]">Target 85%</span>
              </div>
            </div>
          </Link>

          {/* SLA Breaches & Total Intake */}
          <Link
            to="/complaints/escalated"
            className="group flex flex-col items-start lg:items-center justify-between p-5 hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="lg:text-center">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#0044B3]">
                {stats.slaBreaches > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
              <div className="mt-3 text-sm font-semibold text-[#1E293B] group-hover:text-[#0044B3]">
                SLA Breaches
              </div>
              <div className="text-xs text-[#64748B]">{stats.newToday} new today</div>
            </div>
            <div className="mt-4 lg:text-center">
              <div className="flex items-baseline gap-1.5 lg:justify-center">
                <span
                  className={`font-mono-tabular text-3xl font-bold ${
                    stats.slaBreaches > 0 ? 'text-[#EF4444]' : 'text-[#1E293B]'
                  }`}
                >
                  {stats.slaBreaches}
                </span>
                <span className="text-sm font-medium text-[#64748B] tabular-nums">
                  of {stats.total}
                </span>
              </div>
              <div className="mt-3 h-[3px] w-16 rounded-full bg-[#EF4444] lg:mx-auto" />
            </div>
          </Link>
        </div>

        {/* Bottom Half: Total Complaints Trend Chart */}
        <div className="border-t border-[#E2E8F0] p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Total Complaints</h3>
              <p className="text-xs text-[#64748B]">
                7-day intake volume compared against verified municipal resolutions
              </p>
            </div>
            <div className="flex items-center gap-5 text-xs font-medium text-[#1E293B]">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-4 rounded-full bg-[#0044B3]" />
                <span>Reported</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-4 rounded-full bg-[#0EA5E9]" />
                <span>Resolved</span>
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceTrend} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="reported"
                  name="Reported"
                  stroke="#0044B3"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0044B3', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0044B3', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="#0EA5E9"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0EA5E9', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#0EA5E9', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3. Theme-Matched Middle Row: Recent Complaints + Complaints in Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Recent Complaints Table Card */}
        <section className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-7 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Recent Complaints</h3>
              <p className="text-xs text-[#64748B]">
                Latest civic reports within your administrative scope
              </p>
            </div>
            <Link
              to="/complaints"
              className="text-xs font-semibold text-[#0044B3] hover:underline whitespace-nowrap"
            >
              View All Complaints →
            </Link>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-2.5">
            <div className="relative flex-1 min-w-[170px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="search"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by ID, issue, or ward..."
                className="w-full rounded-lg border border-[#E2E8F0] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#0044B3] focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as ComplaintCategory | 'All');
                setPage(1);
              }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="Road Maintenance">Road Maintenance</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Electricity">Electricity</option>
              <option value="Drainage">Drainage</option>
              <option value="Public Infrastructure">Public Infrastructure</option>
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ComplaintStatus | 'All');
                setPage(1);
              }}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolution Submitted">Resolution Submitted</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F1F5F9] whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#64748B]" />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                  <th className="px-4 py-2.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5">Issue & ID</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Category</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Department</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {pagedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#64748B]">
                      No complaints match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  pagedComplaints.map((c) => {
                    const dept = c.assignedDepartmentId ? deptMap[c.assignedDepartmentId] : null;
                    return (
                      <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 font-mono-tabular text-[11px] text-[#64748B] whitespace-nowrap">
                          {formatShortDate(c.reportedAt)}
                        </td>
                        <td className="px-4 py-3 max-w-[230px]">
                          <Link
                            to={`/complaints/${c.id}`}
                            className="font-semibold text-[#1E293B] hover:text-[#0044B3] line-clamp-1"
                          >
                            {c.title}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                            <span className="font-mono-tabular font-medium text-[#0044B3]">
                              {c.id}
                            </span>
                            <span>·</span>
                            <span className="truncate">{c.ward}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#475569] whitespace-nowrap">{c.category}</td>
                        <td className="px-4 py-3 text-[#475569] whitespace-nowrap">
                          {dept ? dept.name : <span className="text-[#94A3B8]">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusLabel status={c.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-5 py-3 text-xs text-[#64748B]">
            <span className="tabular-nums">
              Showing {pagedComplaints.length} of {filteredTableComplaints.length} complaints
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#1E293B] hover:bg-[#F1F5F9] disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono-tabular text-xs font-medium text-[#1E293B]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#1E293B] hover:bg-[#F1F5F9] disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Complaints in Category Progress Card (Matching Reference Image) */}
        <section className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Complaints in Category</h3>
              <p className="text-xs text-[#64748B]">
                Click a category to filter the recent complaints table
              </p>
            </div>
            {categoryFilter !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('All');
                  setPage(1);
                }}
                className="text-xs font-semibold text-[#0044B3] hover:underline whitespace-nowrap"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="flex-1 divide-y divide-[#F1F5F9] px-5 py-2">
            {categoryBreakdown.map((item) => {
              const isSelected = categoryFilter === item.category;
              return (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setCategoryFilter((prev) => (prev === item.category ? 'All' : item.category));
                    setPage(1);
                  }}
                  className={`w-full py-3.5 text-left transition-colors rounded-lg px-2 -mx-2 ${
                    isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold text-[#1E293B] truncate">
                      {item.category}
                    </span>
                    <div className="w-36 sm:w-44 shrink-0">
                      <div className="h-2.5 w-full rounded-sm bg-[#E2E8F0] overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all duration-300"
                          style={{
                            width: `${Math.max(item.pct, item.count > 0 ? 6 : 0)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between font-mono-tabular text-[11px] text-[#64748B]">
                        <span>{item.pct}%</span>
                        <span>{item.count} case(s)</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* 4. Operational Queue & Critical Alerts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left 7 Cols: Department Workload / Unassigned / High Priority */}
        <section className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-7 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-xl bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setOpsTab('workload')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  opsTab === 'workload'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Department Workload
              </button>
              <button
                type="button"
                onClick={() => setOpsTab('unassigned')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  opsTab === 'unassigned'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Awaiting Assignment ({awaitingAssignment.length})
              </button>
              <button
                type="button"
                onClick={() => setOpsTab('high_priority')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  opsTab === 'high_priority'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                High Priority ({highPriorityIssues.length})
              </button>
            </div>
            <Link
              to={
                opsTab === 'workload'
                  ? '/departments'
                  : opsTab === 'unassigned'
                  ? '/assign'
                  : '/complaints/escalated'
              }
              className="text-xs font-semibold text-[#0044B3] hover:underline whitespace-nowrap"
            >
              Open Module →
            </Link>
          </div>

          <div className="flex-1">
            {opsTab === 'workload' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5 text-right">Assigned</th>
                      <th className="px-4 py-2.5 text-right">Active</th>
                      <th className="px-4 py-2.5 text-right">Resolved</th>
                      <th className="px-4 py-2.5 text-right">Overdue</th>
                      <th className="px-4 py-2.5 w-36">Resolution Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    {departmentWorkload.map((row) => {
                      const pct = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
                      return (
                        <tr key={row.department.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-[#1E293B]">
                              {row.department.name}
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              {row.department.headName}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular text-[#1E293B]">
                            {row.total}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular font-medium text-[#0044B3]">
                            {row.active}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular font-medium text-[#10B981]">
                            {row.resolved}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono-tabular ${
                              row.overdue > 0 ? 'font-bold text-[#EF4444]' : 'text-[#64748B]'
                            }`}
                          >
                            {row.overdue}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-sm bg-[#E2E8F0] overflow-hidden">
                                <div
                                  className="h-full bg-[#0044B3]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-8 text-right font-mono-tabular text-[11px] text-[#64748B]">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {opsTab === 'unassigned' && (
              <div className="divide-y divide-[#E2E8F0]">
                {awaitingAssignment.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#64748B]">
                    All active complaints have been assigned to municipal departments.
                  </div>
                ) : (
                  awaitingAssignment.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <Link
                            to={`/complaints/${c.id}`}
                            className="font-mono-tabular font-semibold text-[#0044B3] hover:underline"
                          >
                            {c.id}
                          </Link>
                          <span className="text-[#94A3B8]">·</span>
                          <PriorityLabel priority={c.priority} />
                          <span className="text-[#94A3B8]">·</span>
                          <span className="text-[11px] text-[#64748B]">{c.category}</span>
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-[#1E293B]">
                          {c.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#64748B]">
                          {c.ward} · Reported {formatShortDate(c.reportedAt)}
                        </div>
                      </div>
                      {canAssign ? (
                        <Link
                          to={`/assign?complaintId=${c.id}`}
                          className="shrink-0 rounded-xl border border-[#0044B3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0044B3] hover:bg-[#EFF6FF] whitespace-nowrap"
                        >
                          Assign
                        </Link>
                      ) : (
                        <Link
                          to={`/complaints/${c.id}`}
                          className="shrink-0 text-xs font-semibold text-[#0044B3] hover:underline"
                        >
                          Open
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {opsTab === 'high_priority' && (
              <div className="divide-y divide-[#E2E8F0]">
                {highPriorityIssues.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#64748B]">
                    No active Critical or High priority issues.
                  </div>
                ) : (
                  highPriorityIssues.slice(0, 5).map((c) => {
                    const sla = formatTimeRemaining(c.resolutionDeadline, c.status, REFERENCE_NOW);
                    return (
                      <Link
                        key={c.id}
                        to={`/complaints/${c.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-[#F8FAFC]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono-tabular font-semibold text-[#0044B3]">
                              {c.id}
                            </span>
                            <PriorityLabel priority={c.priority} />
                            <StatusLabel status={c.status} />
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-[#1E293B]">
                            {c.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#64748B]">
                            {c.ward} · {c.category}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 font-mono-tabular text-[11px] whitespace-nowrap ${
                            sla.isOverdue ? 'font-bold text-[#EF4444]' : 'text-[#64748B]'
                          }`}
                        >
                          {sla.label}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right 5 Cols: Critical Alerts / Overdue / Recent Activity */}
        <section className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-5 py-3.5">
            <div className="flex items-center gap-1 rounded-xl bg-[#F1F5F9] p-1">
              <button
                type="button"
                onClick={() => setAttentionTab('alerts')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  attentionTab === 'alerts'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Alerts ({criticalAlerts.length})
              </button>
              <button
                type="button"
                onClick={() => setAttentionTab('overdue')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  attentionTab === 'overdue'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Overdue ({overdueComplaints.length})
              </button>
              <button
                type="button"
                onClick={() => setAttentionTab('activity')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  attentionTab === 'activity'
                    ? 'bg-white text-[#0044B3] shadow-2xs'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Audit Feed
              </button>
            </div>
            <Link
              to={attentionTab === 'activity' ? '/activity-logs' : '/complaints/escalated'}
              className="text-xs font-semibold text-[#0044B3] hover:underline whitespace-nowrap"
            >
              {attentionTab === 'activity' ? 'Full Log →' : 'SLA Matrix →'}
            </Link>
          </div>

          <div className="flex-1 divide-y divide-[#E2E8F0]">
            {attentionTab === 'alerts' &&
              (criticalAlerts.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#64748B]">
                  No critical escalations at this time.
                </div>
              ) : (
                criticalAlerts.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    to={`/complaints/${c.id}`}
                    className="block px-5 py-3 hover:bg-[#F8FAFC]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-semibold text-[#EF4444]">
                        {c.id}
                      </span>
                      <StatusLabel status={c.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#1E293B] line-clamp-1">
                      {c.title}
                    </p>
                    <div className="mt-0.5 text-[11px] text-[#64748B]">
                      {c.ward} ·{' '}
                      {c.assignedOfficerId
                        ? officerMap[c.assignedOfficerId]?.name
                        : 'Unassigned'}
                    </div>
                  </Link>
                ))
              ))}

            {attentionTab === 'overdue' &&
              (overdueComplaints.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#64748B]">
                  All active complaints are within SLA deadlines.
                </div>
              ) : (
                overdueComplaints.slice(0, 5).map((c) => {
                  const sla = formatTimeRemaining(c.resolutionDeadline, c.status, REFERENCE_NOW);
                  return (
                    <Link
                      key={c.id}
                      to={`/complaints/${c.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F8FAFC]"
                    >
                      <div className="min-w-0">
                        <div className="font-mono-tabular text-xs font-semibold text-[#1E293B]">
                          {c.id}
                        </div>
                        <div className="truncate text-xs text-[#64748B]">{c.title}</div>
                      </div>
                      <span className="shrink-0 font-mono-tabular text-[11px] font-bold text-[#EF4444] whitespace-nowrap">
                        {sla.label}
                      </span>
                    </Link>
                  );
                })
              ))}

            {attentionTab === 'activity' &&
              activityLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#1E293B] truncate">{log.action}</div>
                    <div className="mt-0.5 text-[11px] text-[#64748B] truncate">
                      {log.actorName} ({log.actorRole}) · {formatDateTime(log.timestamp)}
                    </div>
                  </div>
                  {log.complaintId && (
                    <Link
                      to={`/complaints/${log.complaintId}`}
                      className="shrink-0 font-mono-tabular text-[11px] font-semibold text-[#0044B3] hover:underline"
                    >
                      {log.complaintId}
                    </Link>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
};
