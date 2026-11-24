import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusLabel, formatShortDate } from '../components/StatusLabels';
import { usePortal } from '../context/PortalContext';
import { DELHI_LOCALITIES } from '../data/seedData';
import { hasPermission } from '../lib/rbac';
import type { Officer, OfficerAvailability } from '../types/civic';

export const StaffPage: React.FC = () => {
  const { currentUser, officers, departments, complaints, createOfficer, updateOfficer } =
    usePortal();

  const canManage = currentUser ? hasPermission(currentUser.role, 'manage_staff') : false;

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [historyOfficer, setHistoryOfficer] = useState<Officer | null>(null);

  // Form fields
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [wardJurisdiction, setWardJurisdiction] = useState(DELHI_LOCALITIES[0]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [availability, setAvailability] = useState<OfficerAvailability>('Available');

  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d])),
    [departments]
  );

  const enrichedOfficers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return officers
      .filter((o) => {
        if (deptFilter !== 'All' && o.departmentId !== deptFilter) return false;
        if (statusFilter !== 'All' && o.status !== statusFilter) return false;
        if (!q) return true;
        return (
          o.name.toLowerCase().includes(q) ||
          o.employeeId.toLowerCase().includes(q) ||
          o.designation.toLowerCase().includes(q) ||
          o.wardJurisdiction.toLowerCase().includes(q)
        );
      })
      .map((o) => {
        const assignedCount = complaints.filter(
          (c) =>
            c.assignedOfficerId === o.id && c.status !== 'Resolved' && c.status !== 'Rejected'
        ).length;
        const workloadPct = Math.min(100, assignedCount * 25);
        return { officer: o, assignedCount, workloadPct };
      });
  }, [officers, complaints, search, deptFilter, statusFilter]);

  const openCreate = () => {
    setEditingOfficer(null);
    setEmployeeId('');
    setName('');
    setDesignation('');
    setDepartmentId(departments[0]?.id || '');
    setWardJurisdiction(DELHI_LOCALITIES[0]);
    setEmail('');
    setPhone('');
    setAvailability('Available');
    setModalMode('create');
  };

  const openEdit = (o: Officer) => {
    setEditingOfficer(o);
    setEmployeeId(o.employeeId);
    setName(o.name);
    setDesignation(o.designation);
    setDepartmentId(o.departmentId);
    setWardJurisdiction(o.wardJurisdiction);
    setEmail(o.email);
    setPhone(o.phone);
    setAvailability(o.availability);
    setModalMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'create') {
      const ok = await createOfficer({
        employeeId,
        name,
        designation,
        departmentId,
        wardJurisdiction,
        email,
        phone,
        availability,
      });
      if (ok) setModalMode(null);
    } else if (modalMode === 'edit' && editingOfficer) {
      const ok = await updateOfficer(editingOfficer.id, {
        name,
        designation,
        departmentId,
        wardJurisdiction,
        email,
        phone,
        availability,
      });
      if (ok) setModalMode(null);
    }
  };

  const officerWorkHistory = useMemo(() => {
    if (!historyOfficer) return [];
    return complaints.filter((c) => c.assignedOfficerId === historyOfficer.id);
  }, [complaints, historyOfficer]);

  return (
    <div className="space-y-4 max-w-[1440px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">Officers & Staff Management</h2>
          <p className="text-xs text-[#64748B]">
            Municipal field personnel directory, ward jurisdictions, workload allocation, and account status
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded bg-[#0044B3] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#003591] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Officer</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-3.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search officer name, employee ID, or ward..."
            className="w-full rounded border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-xs text-[#1E293B] focus:border-[#0044B3] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter by department"
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
        <select
          aria-label="Filter by account status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
          className="rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
        >
          <option value="All">All Account Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </section>

      {/* Officers Table */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Employee ID</th>
                <th className="px-4 py-2.5">Officer & Designation</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Ward / Jurisdiction</th>
                <th className="px-4 py-2.5 text-right">Assigned</th>
                <th className="px-4 py-2.5 text-right">Completed</th>
                <th className="px-4 py-2.5 w-32">Workload</th>
                <th className="px-4 py-2.5">Account Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {enrichedOfficers.map(({ officer: o, assignedCount, workloadPct }) => (
                <tr key={o.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0044B3] whitespace-nowrap">
                    {o.employeeId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E293B]">{o.name}</div>
                    <div className="text-[11px] text-[#64748B]">{o.designation}</div>
                  </td>
                  <td className="px-4 py-3 text-[#1E293B] whitespace-nowrap">
                    {deptMap[o.departmentId]?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                    {o.wardJurisdiction}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#1E293B]">
                    {assignedCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#10B981]">
                    {o.completedComplaints}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-sm bg-[#E2E8F0]">
                        <div
                          className={`h-full ${
                            workloadPct >= 75 ? 'bg-[#F59E0B]' : 'bg-[#0044B3]'
                          }`}
                          style={{ width: `${workloadPct}%` }}
                        />
                      </div>
                      <span className="font-mono-tabular text-[11px] text-[#64748B]">
                        {workloadPct}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block rounded-sm border px-2 py-0.5 text-[11px] font-medium ${
                        o.status === 'Active'
                          ? 'border-[#B7E1CE] bg-[#ECF7F2] text-[#1D6B4A]'
                          : 'border-[#D1D5DB] bg-[#F3F4F6] text-[#64748B]'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                    <button
                      type="button"
                      onClick={() => setHistoryOfficer(o)}
                      className="text-xs font-medium text-[#0044B3] hover:underline"
                    >
                      Work History
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(o)}
                          className="text-xs font-medium text-[#1E293B] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateOfficer(o.id, {
                              status: o.status === 'Active' ? 'Inactive' : 'Active',
                            })
                          }
                          className={`text-xs font-medium hover:underline ${
                            o.status === 'Active' ? 'text-[#EF4444]' : 'text-[#10B981]'
                          }`}
                        >
                          {o.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Work History Drawer */}
      {historyOfficer && (
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B]">
                Work History — {historyOfficer.name} ({historyOfficer.employeeId})
              </h3>
              <p className="text-xs text-[#64748B]">
                {historyOfficer.designation} · {deptMap[historyOfficer.departmentId]?.name} ·{' '}
                {historyOfficer.completedComplaints} career completions
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOfficer(null)}
              className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 divide-y divide-[#E2E8F0]">
            {officerWorkHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#64748B]">
                No current complaints assigned to this officer.
              </div>
            ) : (
              officerWorkHistory.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/complaints/${c.id}`}
                      className="font-mono-tabular font-semibold text-[#0044B3] hover:underline"
                    >
                      {c.id}
                    </Link>
                    <span className="ml-2 font-medium text-[#1E293B]">{c.title}</span>
                    <div className="text-[11px] text-[#64748B]">
                      {c.ward} · Reported {formatShortDate(c.reportedAt)}
                    </div>
                  </div>
                  <StatusLabel status={c.status} />
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Add / Edit Officer Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E293B]/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <h3 className="text-sm font-semibold text-[#1E293B]">
                {modalMode === 'create' ? 'Register Municipal Officer' : 'Edit Officer Details'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Employee ID</label>
                  <input
                    required
                    disabled={modalMode === 'edit'}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP-2190"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5 disabled:bg-[#F8FAFC]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-[#1E293B] mb-1">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Designation</label>
                <input
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Field Operations Engineer"
                  className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">
                    Ward / Jurisdiction
                  </label>
                  <select
                    value={wardJurisdiction}
                    onChange={(e) => setWardJurisdiction(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    {DELHI_LOCALITIES.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Availability</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as OfficerAvailability)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    <option value="Available">Available</option>
                    <option value="On Field Duty">On Field Duty</option>
                    <option value="At Capacity">At Capacity</option>
                    <option value="Off Duty">Off Duty</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded border border-[#E2E8F0] bg-white px-3 py-1.5 font-medium text-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#0044B3] px-3.5 py-1.5 font-medium text-white hover:bg-[#003591]"
                >
                  {modalMode === 'create' ? 'Register Officer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
