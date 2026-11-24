import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, X } from 'lucide-react';
import { formatDateTime } from '../components/StatusLabels';
import { usePortal } from '../context/PortalContext';
import { hasPermission } from '../lib/rbac';
import type { AdminRole, PortalUser } from '../types/civic';

export const UserManagementPage: React.FC = () => {
  const { currentUser, users, departments, createUser, updateUser } = usePortal();
  const [modalOpen, setModalOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<AdminRole>('District Admin');
  const [departmentId, setDepartmentId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('South Delhi');
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<PortalUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  if (!currentUser || !hasPermission(currentUser.role, 'manage_users')) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] p-8 text-center">
        <h2 className="text-sm font-semibold text-[#1E293B]">Super Admin Authorization Required</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Only Super Admin officials can provision and manage government portal accounts.
        </p>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createUser({
      employeeId,
      name,
      email,
      designation,
      role,
      departmentId: departmentId || null,
      jurisdiction,
      password: initialPassword,
    });
    if (ok) {
      setModalOpen(false);
      setEmployeeId('');
      setName('');
      setEmail('');
      setDesignation('');
      setInitialPassword('');
      setShowInitialPassword(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    const ok = await updateUser(passwordTarget.id, { password: resetPassword });
    if (ok) {
      setPasswordTarget(null);
      setResetPassword('');
      setShowResetPassword(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1440px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">User Management & Access Roles</h2>
          <p className="text-xs text-[#64748B]">
            Provision authorized government accounts and enforce role-based administrative scope
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-[#0044B3] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#003591]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Official Account</span>
        </button>
      </div>

      {/* Portal Accounts Table */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
                <th className="px-4 py-2.5">Employee ID</th>
                <th className="px-4 py-2.5">Official</th>
                <th className="px-4 py-2.5">Assigned Role</th>
                <th className="px-4 py-2.5">Department / Unit</th>
                <th className="px-4 py-2.5">Jurisdiction</th>
                <th className="px-4 py-2.5">Last Login</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0044B3]">
                    {u.employeeId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1E293B]">{u.name}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {u.designation} · {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Change role for ${u.name}`}
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => updateUser(u.id, { role: e.target.value as AdminRole })}
                      className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#1E293B] disabled:bg-[#F8FAFC]"
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="State Admin">State Admin</option>
                      <option value="District Admin">District Admin</option>
                      <option value="Field Officer">Field Officer</option>
                      <option value="Rescue / Response Team Member">
                        Rescue / Response Team Member
                      </option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[#1E293B]">{u.departmentName}</td>
                  <td className="px-4 py-3 text-[#64748B]">{u.jurisdiction}</td>
                  <td className="px-4 py-3 font-mono-tabular text-[11px] text-[#64748B] whitespace-nowrap">
                    {formatDateTime(u.lastLogin)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-sm border px-2 py-0.5 text-[11px] font-medium ${
                        u.status === 'Active'
                          ? 'border-[#B7E1CE] bg-[#ECF7F2] text-[#1D6B4A]'
                          : 'border-[#D1D5DB] bg-[#F3F4F6] text-[#64748B]'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordTarget(u);
                          setResetPassword('');
                          setShowResetPassword(false);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0044B3] hover:underline"
                      >
                        <KeyRound className="h-3 w-3" />
                        <span>Set Password</span>
                      </button>
                      {u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() =>
                            updateUser(u.id, {
                              status: u.status === 'Active' ? 'Inactive' : 'Active',
                            })
                          }
                          className={`text-xs font-medium hover:underline ${
                            u.status === 'Active' ? 'text-[#EF4444]' : 'text-[#10B981]'
                          }`}
                        >
                          {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Role-Based Access Scope Reference */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-[#E2E8F0] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#1E293B]">
            Administrative Role Permissions Reference
          </h3>
        </div>
        <div className="divide-y divide-[#E2E8F0] text-xs">
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
            <div className="font-semibold text-[#1E293B]">Super Admin</div>
            <div className="sm:col-span-3 text-[#64748B]">
              Full system access, account provisioning, department & staff management, system
              configuration, complaint triage, verification, and escalation.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
            <div className="font-semibold text-[#1E293B]">State Admin</div>
            <div className="sm:col-span-3 text-[#64748B]">
              State-level oversight, district performance monitoring, escalation tracking, live map,
              activity logs, and statewide report exports.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
            <div className="font-semibold text-[#1E293B]">District Admin</div>
            <div className="sm:col-span-3 text-[#64748B]">
              District operations, complaint review, department & officer assignment, municipal
              performance monitoring, and district-level escalations.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
            <div className="font-semibold text-[#1E293B]">Field Officer</div>
            <div className="sm:col-span-3 text-[#64748B]">
              Scoped strictly to assigned complaints/department; updates field work progress,
              uploads evidence photos, and adds internal remarks.
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-4">
            <div className="font-semibold text-[#1E293B]">Rescue / Response Team Member</div>
            <div className="sm:col-span-3 text-[#64748B]">
              Scoped to assigned and Critical/Emergency incidents; updates emergency response
              progress, uploads field evidence, and submits completion reports.
            </div>
          </div>
        </div>
      </section>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E293B]/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <h3 className="text-sm font-semibold text-[#1E293B]">
                Create Administrative Portal Account
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Employee ID</label>
                  <input
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="ADM-045"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Official Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Designation</label>
                  <input
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Portal Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AdminRole)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="State Admin">State Admin</option>
                    <option value="District Admin">District Admin</option>
                    <option value="Field Officer">Field Officer</option>
                    <option value="Rescue / Response Team Member">
                      Rescue / Response Team Member
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">
                    Department (Optional)
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                  >
                    <option value="">Municipal Secretariat</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Jurisdiction</label>
                <input
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">
                  Initial Login Password
                </label>
                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={showInitialPassword ? 'text' : 'password'}
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword((v) => !v)}
                    aria-label={showInitialPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B]"
                  >
                    {showInitialPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded border border-[#E2E8F0] bg-white px-3 py-1.5 font-medium text-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#0044B3] px-3.5 py-1.5 font-medium text-white hover:bg-[#003591]"
                >
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set / Reset Official Password Modal */}
      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E293B]/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <h3 className="text-sm font-semibold text-[#1E293B]">
                Set Portal Password · {passwordTarget.employeeId}
              </h3>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="text-[#64748B] hover:text-[#1E293B]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-5 space-y-3 text-xs">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="font-semibold text-[#1E293B]">{passwordTarget.name}</div>
                <div className="text-[#64748B]">
                  {passwordTarget.role} · {passwordTarget.email}
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">
                  New Password (min 8 characters)
                </label>
                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded border border-[#E2E8F0] px-2.5 py-1.5 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B]"
                  >
                    {showResetPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="rounded border border-[#E2E8F0] bg-white px-3 py-1.5 font-medium text-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-[#0044B3] px-3.5 py-1.5 font-medium text-white hover:bg-[#003591]"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
