import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { hasPermission, isComplaintOverdue } from '../lib/rbac';
import type { Department } from '../types/civic';

const REFERENCE_NOW = new Date('2026-11-24T09:15:00Z').getTime();

export const DepartmentsPage: React.FC = () => {
  const { currentUser, departments, complaints, officers, createDepartment, updateDepartment } =
    usePortal();

  const canManage = currentUser ? hasPermission(currentUser.role, 'manage_departments') : false;

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [perfDept, setPerfDept] = useState<Department | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [headName, setHeadName] = useState('');
  const [headEmployeeId, setHeadEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slaTargetHours, setSlaTargetHours] = useState(48);

  const deptStats = useMemo(() => {
    return departments.map((dept) => {
      const assigned = complaints.filter((c) => c.assignedDepartmentId === dept.id);
      const pending = assigned.filter((c) => c.status === 'Pending' || c.status === 'New').length;
      const inProgress = assigned.filter(
        (c) => c.status === 'In Progress' || c.status === 'Resolution Submitted'
      ).length;
      const resolved = assigned.filter((c) => c.status === 'Resolved').length;
      const overdue = assigned.filter((c) => isComplaintOverdue(c, REFERENCE_NOW)).length;
      const deptOfficers = officers.filter((o) => o.departmentId === dept.id);
      const slaPct =
        assigned.length > 0
          ? Math.round(((assigned.length - overdue) / assigned.length) * 100)
          : 100;
      return {
        dept,
        total: assigned.length,
        pending,
        inProgress,
        resolved,
        overdue,
        officerCount: deptOfficers.length,
        slaPct,
      };
    });
  }, [departments, complaints, officers]);

  const openCreateModal = () => {
    setEditingDept(null);
    setCode('');
    setName('');
    setHeadName('');
    setHeadEmployeeId('');
    setEmail('');
    setPhone('');
    setSlaTargetHours(48);
    setModalMode('create');
  };

  const openEditModal = (d: Department) => {
    setEditingDept(d);
    setCode(d.code);
    setName(d.name);
    setHeadName(d.headName);
    setHeadEmployeeId(d.headEmployeeId);
    setEmail(d.email);
    setPhone(d.phone);
    setSlaTargetHours(d.slaTargetHours);
    setModalMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'create') {
      const ok = await createDepartment({
        code,
        name,
        headName,
        headEmployeeId,
        email,
        phone,
        slaTargetHours,
      });
      if (ok) setModalMode(null);
    } else if (modalMode === 'edit' && editingDept) {
      const ok = await updateDepartment(editingDept.id, {
        code,
        name,
        headName,
        headEmployeeId,
        email,
        phone,
        slaTargetHours,
      });
      if (ok) setModalMode(null);
    }
  };

  return (
    <div className="space-y-4 max-w-[1440px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">Department Management</h2>
          <p className="text-xs text-[#64748B]">
            Municipal operating departments, leadership assignments, and caseload metrics
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded bg-[#0044B3] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#003591] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Department</span>
          </button>
        )}
      </div>

      {/* Department Table */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Department Name</th>
                <th className="px-4 py-2.5">Department Head</th>
                <th className="px-4 py-2.5 text-right">Staff</th>
                <th className="px-4 py-2.5 text-right">Assigned</th>
                <th className="px-4 py-2.5 text-right">Pending</th>
                <th className="px-4 py-2.5 text-right">In Progress</th>
                <th className="px-4 py-2.5 text-right">Resolved</th>
                <th className="px-4 py-2.5 text-right">Overdue</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {deptStats.map((row) => (
                <tr key={row.dept.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0044B3]">
                    {row.dept.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E293B]">{row.dept.name}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {row.dept.email} · Target SLA {row.dept.slaTargetHours}h
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[#1E293B]">{row.dept.headName}</div>
                    <div className="font-mono-tabular text-[11px] text-[#64748B]">
                      {row.dept.headEmployeeId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#1E293B]">
                    {row.officerCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular font-medium text-[#1E293B]">
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#F59E0B]">
                    {row.pending}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#0044B3]">
                    {row.inProgress}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-tabular text-[#10B981]">
                    {row.resolved}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono-tabular ${
                      row.overdue > 0 ? 'font-semibold text-[#EF4444]' : 'text-[#64748B]'
                    }`}
                  >
                    {row.overdue}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                    <button
                      type="button"
                      onClick={() => setPerfDept(row.dept)}
                      className="text-xs font-medium text-[#0044B3] hover:underline"
                    >
                      Performance
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => openEditModal(row.dept)}
                        className="text-xs font-medium text-[#1E293B] hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Department Performance Summary Panel */}
      {perfDept && (
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B]">
                {perfDept.name} ({perfDept.code}) — Operational Breakdown
              </h3>
              <p className="text-xs text-[#64748B]">
                Department Head: {perfDept.headName} · Contact: {perfDept.phone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPerfDept(null)}
              className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded border border-[#E2E8F0] p-3">
              <div className="text-[#64748B]">Assigned Field Staff</div>
              <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#1E293B]">
                {officers.filter((o) => o.departmentId === perfDept.id).length} officer(s)
              </div>
            </div>
            <div className="rounded border border-[#E2E8F0] p-3">
              <div className="text-[#64748B]">Standard SLA Window</div>
              <div className="mt-1 font-mono-tabular text-lg font-semibold text-[#0044B3]">
                {perfDept.slaTargetHours} hours
              </div>
            </div>
            <div className="rounded border border-[#E2E8F0] p-3">
              <div className="text-[#64748B]">Covered Wards</div>
              <div className="mt-1 text-xs font-medium text-[#1E293B]">
                {perfDept.activeWards.join(', ')}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Add / Edit Department Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E293B]/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <h3 className="text-sm font-semibold text-[#1E293B]">
                {modalMode === 'create' ? 'Add Municipal Department' : 'Edit Department & Head'}
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
                  <label className="block font-medium text-[#1E293B] mb-1">Dept Code</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. TRF-SIG"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-[#1E293B] mb-1">Department Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Traffic Signals"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Department Head</label>
                  <input
                    required
                    value={headName}
                    onChange={(e) => setHeadName(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Head Employee ID</label>
                  <input
                    value={headEmployeeId}
                    onChange={(e) => setHeadEmployeeId(e.target.value)}
                    placeholder="EMP-1050"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">SLA Target (Hours)</label>
                  <input
                    type="number"
                    min={4}
                    max={240}
                    value={slaTargetHours}
                    onChange={(e) => setSlaTargetHours(Number(e.target.value))}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
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
                  {modalMode === 'create' ? 'Create Department' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
