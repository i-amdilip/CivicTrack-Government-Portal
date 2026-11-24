import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PriorityLabel, StatusLabel, formatShortDate } from '../components/StatusLabels';
import { usePortal } from '../context/PortalContext';
import { hasPermission } from '../lib/rbac';

export const AssignmentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialComplaintId = searchParams.get('complaintId');
  const { currentUser, complaints, departments, officers, performComplaintAction } = usePortal();

  const assignableComplaints = useMemo(() => {
    return complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected');
  }, [complaints]);

  const [complaintSearch, setComplaintSearch] = useState('');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>(
    initialComplaintId || assignableComplaints[0]?.id || ''
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    departments[0]?.id || ''
  );
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('2026-11-26T17:00');
  const [instructions, setInstructions] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedComplaint = useMemo(
    () => complaints.find((c) => c.id === selectedComplaintId) || null,
    [complaints, selectedComplaintId]
  );

  useEffect(() => {
    if (initialComplaintId) {
      setSelectedComplaintId(initialComplaintId);
    }
  }, [initialComplaintId]);

  useEffect(() => {
    if (selectedComplaint) {
      const matchedDept =
        selectedComplaint.assignedDepartmentId ||
        departments.find((d) => d.name === selectedComplaint.category)?.id ||
        departments[0]?.id ||
        '';
      setSelectedDepartmentId(matchedDept);
      setSelectedOfficerId(selectedComplaint.assignedOfficerId || '');
      setDeadline(selectedComplaint.resolutionDeadline.slice(0, 16));
      setInstructions(selectedComplaint.assignmentInstructions || '');
    }
  }, [selectedComplaint, departments]);

  const filteredQueue = useMemo(() => {
    const q = complaintSearch.trim().toLowerCase();
    return assignableComplaints.filter((c) => {
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.ward.toLowerCase().includes(q)
      );
    });
  }, [assignableComplaints, complaintSearch]);

  const departmentOfficers = useMemo(() => {
    return officers
      .filter((o) => o.departmentId === selectedDepartmentId && o.status === 'Active')
      .map((o) => {
        const activeCount = complaints.filter(
          (c) =>
            c.assignedOfficerId === o.id &&
            c.status !== 'Resolved' &&
            c.status !== 'Rejected'
        ).length;
        const workloadPct = Math.min(100, activeCount * 25);
        return { officer: o, activeCount, workloadPct };
      });
  }, [officers, selectedDepartmentId, complaints]);

  if (!currentUser || !hasPermission(currentUser.role, 'assign_complaint')) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-8 text-center">
        <h2 className="text-sm font-semibold text-[#1E293B]">Access Restricted</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Only authorized Super Admins and District Admins may assign complaints across departments.
        </p>
      </div>
    );
  }

  const chosenDept = departments.find((d) => d.id === selectedDepartmentId);
  const chosenOfficer = officers.find((o) => o.id === selectedOfficerId);

  return (
    <div className="space-y-4 max-w-[1440px]">
      <div>
        <h2 className="text-lg font-semibold text-[#1E293B]">Complaint Assignment System</h2>
        <p className="text-xs text-[#64748B]">
          Assign incoming and active civic complaints to authorized departments and available field
          officers based on jurisdiction and workload.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Step 1: Select Complaint */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-5">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">1. Select Complaint</h3>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="search"
                value={complaintSearch}
                onChange={(e) => setComplaintSearch(e.target.value)}
                placeholder="Search ID, title, or ward..."
                className="w-full rounded border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-8 pr-2.5 text-xs text-[#1E293B] focus:border-[#0044B3] focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-[540px] divide-y divide-[#E2E8F0] overflow-y-auto">
            {filteredQueue.map((c) => {
              const active = c.id === selectedComplaintId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedComplaintId(c.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors ${
                    active ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-semibold text-[#0044B3]">
                      {c.id}
                    </span>
                    <StatusLabel status={c.status} />
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#1E293B] line-clamp-1">
                    {c.title}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>
                      {c.category} · {c.ward}
                    </span>
                    <PriorityLabel priority={c.priority} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#64748B]">
                    {c.assignedDepartmentId
                      ? `Currently: ${
                          departments.find((d) => d.id === c.assignedDepartmentId)?.name || ''
                        }`
                      : 'Unassigned'}
                    {' · '}Reported {formatShortDate(c.reportedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Steps 2–7: Department, Officers, Deadline, Instructions */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] lg:col-span-7">
          {!selectedComplaint ? (
            <div className="p-8 text-center text-xs text-[#64748B]">
              Select a complaint from the queue to configure assignment.
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              <div className="px-5 py-3.5 bg-[#FAFBFC] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-[#64748B]">Selected Complaint</div>
                  <div className="text-sm font-semibold text-[#1E293B] truncate">
                    {selectedComplaint.id} — {selectedComplaint.title}
                  </div>
                </div>
                <Link
                  to={`/complaints/${selectedComplaint.id}`}
                  className="shrink-0 text-xs font-medium text-[#0044B3] hover:underline"
                >
                  View Full Record
                </Link>
              </div>

              <div className="p-5 space-y-5">
                {/* Step 2: Department */}
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                    2. Select Responsible Department
                  </label>
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => {
                      setSelectedDepartmentId(e.target.value);
                      setSelectedOfficerId('');
                    }}
                    className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code}) — Head: {d.headName} · SLA {d.slaTargetHours}h
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3 & 4: Available Officers & Workload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1E293B]">
                      3. Select Officer in {chosenDept?.name || 'Department'}
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Scoped strictly to selected department
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded border border-[#E2E8F0]">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                          <th className="px-3 py-2 w-8"></th>
                          <th className="px-3 py-2">Officer</th>
                          <th className="px-3 py-2">Designation</th>
                          <th className="px-3 py-2">Jurisdiction</th>
                          <th className="px-3 py-2 text-right">Assigned</th>
                          <th className="px-3 py-2">Workload</th>
                          <th className="px-3 py-2">Availability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {departmentOfficers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-4 text-center text-[#64748B]">
                              No active officers registered in this department.
                            </td>
                          </tr>
                        ) : (
                          departmentOfficers.map(({ officer: off, activeCount, workloadPct }) => {
                            const isSelected = selectedOfficerId === off.id;
                            return (
                              <tr
                                key={off.id}
                                onClick={() => setSelectedOfficerId(off.id)}
                                className={`cursor-pointer ${
                                  isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                                }`}
                              >
                                <td className="px-3 py-2.5">
                                  <div
                                    className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                      isSelected
                                        ? 'border-[#0044B3] bg-[#0044B3] text-white'
                                        : 'border-[#D1D5DB] bg-white'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-medium text-[#1E293B]">
                                  {off.name}
                                  <div className="font-mono-tabular text-[10px] text-[#64748B]">
                                    {off.employeeId}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-[#64748B]">{off.designation}</td>
                                <td className="px-3 py-2.5 text-[#64748B]">
                                  {off.wardJurisdiction}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono-tabular text-[#1E293B]">
                                  {activeCount}
                                </td>
                                <td className="px-3 py-2.5 w-28">
                                  <div className="flex items-center gap-1.5">
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
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span
                                    className={`text-[11px] font-medium ${
                                      off.availability === 'Available'
                                        ? 'text-[#10B981]'
                                        : off.availability === 'At Capacity'
                                        ? 'text-[#EF4444]'
                                        : 'text-[#64748B]'
                                    }`}
                                  >
                                    {off.availability}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Step 6 & 7: Resolution Deadline & Instructions */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      4. Resolution Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      5. Assignment Instructions
                    </label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Dispatch crew instructions, safety equipment notes..."
                      className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-xs text-[#1E293B] focus:border-[#0044B3] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                  <button
                    type="button"
                    disabled={!selectedDepartmentId}
                    onClick={() => setConfirmOpen(true)}
                    className="rounded bg-[#0044B3] px-4 py-2 text-xs font-medium text-white hover:bg-[#003591] disabled:opacity-40"
                  >
                    Assign Complaint
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Complaint Assignment"
        description={`Assign ${selectedComplaint?.id || ''} to ${chosenDept?.name || ''}${
          chosenOfficer ? ` (${chosenOfficer.name})` : ''
        } with resolution deadline ${deadline.replace('T', ' ')}?`}
        confirmLabel="Confirm Assignment"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (!selectedComplaint) return;
          await performComplaintAction(selectedComplaint.id, {
            actionType: 'assign',
            departmentId: selectedDepartmentId,
            officerId: selectedOfficerId || null,
            resolutionDeadline: deadline,
            instructions,
          });
          setConfirmOpen(false);
        }}
      />
    </div>
  );
};
