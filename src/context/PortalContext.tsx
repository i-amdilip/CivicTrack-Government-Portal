import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  SEED_ACTIVITY_LOGS,
  SEED_COMPLAINTS,
  SEED_DEPARTMENTS,
  SEED_NOTIFICATIONS,
  SEED_OFFICERS,
  SEED_SETTINGS,
  SEED_USERS,
} from '../data/seedData';
import { canUserAccessComplaint, hasPermission } from '../lib/rbac';
import type {
  ActivityLogEntry,
  AdminRole,
  Complaint,
  ComplaintStatus,
  Department,
  ImageAnalysisResult,
  Officer,
  OperationalBriefingResult,
  PortalNotification,
  PortalUser,
  PriorityLevel,
  SystemSettings,
} from '../types/civic';

export interface CreateUserPayload extends Partial<PortalUser> {
  password: string;
}

export interface UpdateUserPayload extends Partial<PortalUser> {
  password?: string;
}

export interface DemoAccount {
  id: string;
  employeeId: string;
  name: string;
  role: AdminRole;
  designation: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ComplaintActionPayload {
  actionType:
    | 'review'
    | 'change_priority'
    | 'assign'
    | 'update_progress'
    | 'verify_resolution'
    | 'reject'
    | 'escalate'
    | 'add_remark'
    | 'add_evidence';
  priority?: PriorityLevel;
  departmentId?: string;
  officerId?: string | null;
  resolutionDeadline?: string;
  instructions?: string;
  status?: ComplaintStatus;
  reason?: string;
  remark?: string;
  photoUrl?: string;
  photoCaption?: string;
  photoType?: 'Supporting' | 'Progress' | 'Resolution';
}

interface PortalContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  authSetupRequired: boolean;
  demoEnabled: boolean;
  demoAccounts: DemoAccount[];
  primaryAdminId: string;
  authError: string | null;
  clearAuthError: () => void;
  currentUser: PortalUser | null;
  complaints: Complaint[];
  departments: Department[];
  officers: Officer[];
  users: PortalUser[];
  activityLogs: ActivityLogEntry[];
  notifications: PortalNotification[];
  settings: SystemSettings;
  globalSearch: string;
  setGlobalSearch: (val: string) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  loginWithCredentials: (identifier: string, password: string) => Promise<boolean>;
  loginAsDemo: (userId?: string) => Promise<boolean>;
  setupInitialCredentials: (payload: {
    password: string;
    confirmPassword: string;
    initializeAllSeeded: boolean;
  }) => Promise<string[] | null>;
  logout: () => void;
  refreshState: () => Promise<void>;
  performComplaintAction: (complaintId: string, payload: ComplaintActionPayload) => Promise<Complaint | null>;
  createDepartment: (payload: Partial<Department>) => Promise<boolean>;
  updateDepartment: (id: string, payload: Partial<Department>) => Promise<boolean>;
  createOfficer: (payload: Partial<Officer>) => Promise<boolean>;
  updateOfficer: (id: string, payload: Partial<Officer>) => Promise<boolean>;
  createUser: (payload: CreateUserPayload) => Promise<boolean>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<boolean>;
  updateSettings: (payload: Partial<SystemSettings>) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<void>;
  analyzeEvidenceImage: (payload: {
    imageBase64?: string;
    mimeType?: string;
    assetPath?: string;
    complaintContext?: string;
  }) => Promise<ImageAnalysisResult>;
  requestOperationalBriefing: (payload: {
    query: string;
    complaintId?: string;
  }) => Promise<OperationalBriefingResult>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokenRef = useRef<string | null>(null);
  const isStaticModeRef = useRef<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authSetupRequired, setAuthSetupRequired] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [primaryAdminId, setPrimaryAdminId] = useState('ADM-001');
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(SEED_SETTINGS);
  const [globalSearch, setGlobalSearch] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    if (tokenRef.current) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    }
    return data;
  }, []);

  const refreshState = useCallback(async () => {
    if (isStaticModeRef.current || !tokenRef.current) return;
    const data = await authedFetch('/api/portal-state');
    setCurrentUser(data.currentUser);
    setComplaints(data.complaints);
    setDepartments(data.departments);
    setOfficers(data.officers);
    setUsers(data.users);
    setActivityLogs(data.activityLogs);
    setNotifications(data.notifications);
    setSettings(data.settings);
  }, [authedFetch]);

  const loginWithCredentials = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      if (isStaticModeRef.current) {
        setAuthError(
          'Official ID & Password login requires the Express backend server. Please use Demo Login (No ID / Password) on static hosting.'
        );
        return false;
      }
      setIsLoading(true);
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Authentication failed.');
        }
        tokenRef.current = data.token;
        setIsAuthenticated(true);
        await refreshState();
        addToast({
          type: 'success',
          title: `Signed in as ${data.user.name}`,
          message: `${data.user.role} · ${data.user.jurisdiction}`,
        });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to establish session.';
        setAuthError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshState, addToast]
  );

  const loginAsDemo = useCallback(
    async (userId?: string): Promise<boolean> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        if (isStaticModeRef.current) {
          const targetId = userId || 'usr-1';
          const user = SEED_USERS.find((u) => u.id === targetId && u.status === 'Active') || SEED_USERS[0];
          const loggedUser: PortalUser = { ...user, lastLogin: new Date().toISOString() };
          const scopedComplaints = structuredClone(SEED_COMPLAINTS)
            .filter((c) => canUserAccessComplaint(loggedUser, c))
            .map((c) =>
              hasPermission(loggedUser.role, 'view_citizen_full_info') ||
              !SEED_SETTINGS.citizenMaskingForFieldOfficers
                ? c
                : {
                    ...c,
                    citizen: {
                      citizenId: c.citizen.citizenId,
                      name: `${c.citizen.name.charAt(0)}. [Redacted]`,
                      phone: 'Restricted (Admin Only)',
                      email: 'Restricted (Admin Only)',
                    },
                  }
            );
          const allowedIds = new Set(scopedComplaints.map((c) => c.id));
          setCurrentUser(loggedUser);
          setComplaints(scopedComplaints);
          setDepartments(structuredClone(SEED_DEPARTMENTS));
          setOfficers(
            hasPermission(loggedUser.role, 'view_staff') ||
              hasPermission(loggedUser.role, 'assign_complaint')
              ? structuredClone(SEED_OFFICERS)
              : structuredClone(SEED_OFFICERS).filter(
                  (o) => !loggedUser.departmentId || o.departmentId === loggedUser.departmentId
                )
          );
          setUsers(
            hasPermission(loggedUser.role, 'manage_users')
              ? structuredClone(SEED_USERS)
              : [loggedUser]
          );
          setActivityLogs(
            hasPermission(loggedUser.role, 'view_activity_logs')
              ? structuredClone(SEED_ACTIVITY_LOGS).filter(
                  (l) => !l.complaintId || allowedIds.has(l.complaintId)
                )
              : []
          );
          setNotifications(
            structuredClone(SEED_NOTIFICATIONS).filter(
              (n) => !n.complaintId || allowedIds.has(n.complaintId)
            )
          );
          setSettings(structuredClone(SEED_SETTINGS));
          setIsAuthenticated(true);
          addToast({
            type: 'info',
            title: `Demo Session: ${loggedUser.name}`,
            message: `${loggedUser.role} · ${loggedUser.jurisdiction}`,
          });
          return true;
        }

        const res = await fetch('/api/auth/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId || 'usr-1' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Demo login unavailable.');
        }
        tokenRef.current = data.token;
        setIsAuthenticated(true);
        await refreshState();
        addToast({
          type: 'info',
          title: `Demo Session: ${data.user.name}`,
          message: `${data.user.role} · ${data.user.jurisdiction}`,
        });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to start demo session.';
        setAuthError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshState, addToast]
  );

  const setupInitialCredentials = useCallback(
    async (payload: {
      password: string;
      confirmPassword: string;
      initializeAllSeeded: boolean;
    }): Promise<string[] | null> => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to initialize credentials.');
        }
        setAuthSetupRequired(false);
        addToast({
          type: 'success',
          title: 'Official Credentials Initialized',
          message: 'Sign in using your Official ID and newly configured password.',
        });
        return Array.isArray(data.initializedIds) ? (data.initializedIds as string[]) : ['ADM-001'];
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Credential initialization failed.';
        setAuthError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [addToast]
  );

  const logout = useCallback(() => {
    tokenRef.current = null;
    setIsAuthenticated(false);
    setAuthError(null);
    setCurrentUser(null);
    setComplaints([]);
    setActivityLogs([]);
    setNotifications([]);
    addToast({
      type: 'info',
      title: 'Session Terminated',
      message: 'You have been logged out of the CivicTrack Government Portal.',
    });
  }, [addToast]);

  useEffect(() => {
    let mounted = true;
    const enableStaticFallback = () => {
      isStaticModeRef.current = true;
      setAuthSetupRequired(false);
      setDemoEnabled(true);
      setDemoAccounts(
        SEED_USERS.filter((u) => u.status === 'Active').map((u) => ({
          id: u.id,
          employeeId: u.employeeId,
          name: u.name,
          role: u.role,
          designation: u.designation,
        }))
      );
      setSettings(SEED_SETTINGS);
    };

    async function bootstrap() {
      try {
        const statusRes = await fetch('/api/auth/status');
        const contentType = statusRes.headers.get('content-type') || '';
        if (!statusRes.ok || !contentType.includes('application/json')) {
          if (mounted) enableStaticFallback();
          return;
        }
        const statusData = await statusRes.json().catch(() => null);
        if (!mounted) return;
        if (!statusData || typeof statusData.demoEnabled !== 'boolean') {
          enableStaticFallback();
          return;
        }
        isStaticModeRef.current = false;
        setAuthSetupRequired(Boolean(statusData.setupRequired));
        setDemoEnabled(Boolean(statusData.demoEnabled));
        setDemoAccounts(Array.isArray(statusData.demoAccounts) ? statusData.demoAccounts : []);
        if (typeof statusData.primaryAdminId === 'string') {
          setPrimaryAdminId(statusData.primaryAdminId);
        }
        if (statusData.municipalityName || statusData.portalCode) {
          setSettings((prev) => ({
            ...prev,
            municipalityName: statusData.municipalityName || prev.municipalityName,
            portalCode: statusData.portalCode || prev.portalCode,
          }));
        }
      } catch {
        if (mounted) enableStaticFallback();
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const performComplaintAction = useCallback(
    async (complaintId: string, payload: ComplaintActionPayload): Promise<Complaint | null> => {
      if (isStaticModeRef.current && currentUser) {
        const nowIso = new Date().toISOString();
        let updatedTarget: Complaint | null = null;
        setComplaints((prev) =>
          prev.map((c) => {
            if (c.id !== complaintId) return c;
            const copy: Complaint = structuredClone(c);
            const prevStatus = copy.status;
            if (payload.actionType === 'review' && copy.status === 'New') {
              copy.status = 'Reviewed';
            } else if (payload.actionType === 'change_priority' && payload.priority) {
              copy.priority = payload.priority;
            } else if (payload.actionType === 'assign' && payload.departmentId) {
              copy.assignedDepartmentId = payload.departmentId;
              copy.assignedOfficerId = payload.officerId || null;
              if (payload.resolutionDeadline) {
                copy.resolutionDeadline = new Date(payload.resolutionDeadline).toISOString();
              }
              if (payload.instructions !== undefined) {
                copy.assignmentInstructions = payload.instructions.trim();
              }
              if (copy.status === 'New' || copy.status === 'Reviewed') {
                copy.status = 'Pending';
              }
            } else if (payload.actionType === 'update_progress' && payload.status) {
              copy.status = payload.status;
            } else if (payload.actionType === 'verify_resolution') {
              copy.status = 'Resolved';
              copy.resolvedAt = nowIso;
            } else if (payload.actionType === 'reject' && payload.reason) {
              copy.status = 'Rejected';
              copy.rejectionReason = payload.reason.trim();
            } else if (payload.actionType === 'escalate' && payload.reason) {
              copy.status = 'Escalated';
              copy.escalationLevel = Math.min(3, copy.escalationLevel + 1);
              copy.escalationReason = payload.reason.trim();
              copy.priority = 'Critical';
            } else if (payload.actionType === 'add_remark' && payload.remark) {
              copy.internalRemarks.push({
                id: `rem-${Date.now()}`,
                authorName: currentUser.name,
                authorRole: currentUser.role,
                createdAt: nowIso,
                text: payload.remark.trim(),
              });
            } else if (payload.actionType === 'add_evidence' && payload.photoUrl) {
              copy.evidencePhotos.push({
                id: `ev-${Date.now()}`,
                url: payload.photoUrl,
                caption: payload.photoCaption?.trim() || 'Field inspection photograph',
                type: payload.photoType || 'Progress',
                uploadedBy: currentUser.name,
                uploadedAt: nowIso,
              });
            }
            copy.history.push({
              id: `h-${Date.now()}`,
              timestamp: nowIso,
              actorName: currentUser.name,
              actorRole: currentUser.role,
              action: `Demo Action: ${payload.actionType}`,
              previousStatus: prevStatus,
              newStatus: copy.status,
              remarks: payload.remark || payload.reason || payload.instructions,
            });
            updatedTarget = copy;
            return copy;
          })
        );
        addToast({
          type: 'success',
          title: 'Administrative Action Recorded',
          message: `Complaint ${complaintId} updated in demo session.`,
        });
        return updatedTarget;
      }
      try {
        const data = await authedFetch(`/api/complaints/${complaintId}/action`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await refreshState();
        addToast({
          type: 'success',
          title: 'Administrative Action Recorded',
          message: `Complaint ${complaintId} updated successfully.`,
        });
        return data.complaint as Complaint;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Action Failed',
          message: err instanceof Error ? err.message : 'Could not update complaint.',
        });
        return null;
      }
    },
    [authedFetch, refreshState, addToast, currentUser]
  );

  const createDepartment = useCallback(
    async (payload: Partial<Department>) => {
      if (isStaticModeRef.current) {
        const created: Department = {
          id: `dept-${Date.now()}`,
          code: (payload.code || 'NEW').toUpperCase(),
          name: payload.name || 'New Department',
          headName: payload.headName || 'Assigned Head',
          headEmployeeId: payload.headEmployeeId || 'EMP-1099',
          email: payload.email || 'dept@delhicivic.gov.in',
          phone: payload.phone || '+91 11 2349 0190',
          slaTargetHours: Number(payload.slaTargetHours) || 48,
          activeWards: payload.activeWards?.length ? payload.activeWards : ['Lajpat Nagar'],
          status: 'Active',
        };
        setDepartments((prev) => [...prev, created]);
        addToast({ type: 'success', title: 'Department Created', message: `${created.name} added.` });
        return true;
      }
      try {
        await authedFetch('/api/departments', { method: 'POST', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'Department Created', message: `${payload.name} added.` });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Create Department',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const updateDepartment = useCallback(
    async (id: string, payload: Partial<Department>) => {
      if (isStaticModeRef.current) {
        setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, ...payload } : d)));
        addToast({ type: 'success', title: 'Department Updated' });
        return true;
      }
      try {
        await authedFetch(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'Department Updated' });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Update Department',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const createOfficer = useCallback(
    async (payload: Partial<Officer>) => {
      if (isStaticModeRef.current) {
        const created: Officer = {
          id: `off-${Date.now()}`,
          employeeId: (payload.employeeId || 'EMP-2199').toUpperCase(),
          name: payload.name || 'New Officer',
          designation: payload.designation || 'Field Officer',
          departmentId: payload.departmentId || 'dept-pwd',
          wardJurisdiction: payload.wardJurisdiction || 'Lajpat Nagar',
          district: payload.district || 'South Delhi',
          email: payload.email || 'officer@delhicivic.gov.in',
          phone: payload.phone || '+91 98110 10299',
          completedComplaints: 0,
          availability: payload.availability || 'Available',
          status: 'Active',
          joinedDate: new Date().toISOString().slice(0, 10),
        };
        setOfficers((prev) => [...prev, created]);
        addToast({ type: 'success', title: 'Officer Added', message: `${created.name} registered.` });
        return true;
      }
      try {
        await authedFetch('/api/officers', { method: 'POST', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'Officer Added', message: `${payload.name} registered.` });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Add Officer',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const updateOfficer = useCallback(
    async (id: string, payload: Partial<Officer>) => {
      if (isStaticModeRef.current) {
        setOfficers((prev) => prev.map((o) => (o.id === id ? { ...o, ...payload } : o)));
        addToast({ type: 'success', title: 'Officer Record Updated' });
        return true;
      }
      try {
        await authedFetch(`/api/officers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'Officer Record Updated' });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Update Officer',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const createUser = useCallback(
    async (payload: CreateUserPayload) => {
      if (isStaticModeRef.current) {
        const created: PortalUser = {
          id: `usr-${Date.now()}`,
          employeeId: (payload.employeeId || 'ADM-099').toUpperCase(),
          name: payload.name || 'New Official',
          email: payload.email || 'official@delhicivic.gov.in',
          designation: payload.designation || payload.role || 'District Admin',
          role: payload.role || 'District Admin',
          departmentId: payload.departmentId || null,
          departmentName: payload.departmentName || 'Delhi Civic Control',
          jurisdiction: payload.jurisdiction || 'South Delhi',
          status: 'Active',
          lastLogin: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, created]);
        addToast({ type: 'success', title: 'Administrative Account Created' });
        return true;
      }
      try {
        await authedFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'Administrative Account Created' });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Create User',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const updateUser = useCallback(
    async (id: string, payload: UpdateUserPayload) => {
      if (isStaticModeRef.current) {
        const { password: _ignored, ...rest } = payload;
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...rest } : u)));
        addToast({
          type: 'success',
          title: payload.password ? 'Official Password Updated' : 'User Account Updated',
        });
        return true;
      }
      try {
        await authedFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        await refreshState();
        addToast({
          type: 'success',
          title: payload.password ? 'Official Password Updated' : 'User Account Updated',
        });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Update User',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const updateSettings = useCallback(
    async (payload: Partial<SystemSettings>) => {
      if (isStaticModeRef.current) {
        setSettings((prev) => ({
          ...prev,
          ...payload,
          slaHours: { ...prev.slaHours, ...(payload.slaHours || {}) },
        }));
        addToast({ type: 'success', title: 'System Settings Saved' });
        return true;
      }
      try {
        await authedFetch('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
        await refreshState();
        addToast({ type: 'success', title: 'System Settings Saved' });
        return true;
      } catch (err: unknown) {
        addToast({
          type: 'error',
          title: 'Failed to Save Settings',
          message: err instanceof Error ? err.message : 'Request rejected.',
        });
        return false;
      }
    },
    [authedFetch, refreshState, addToast]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (isStaticModeRef.current) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }
    try {
      await authedFetch('/api/notifications/mark-read', { method: 'POST' });
      await refreshState();
    } catch {
      // ignore silently
    }
  }, [authedFetch, refreshState]);

  const analyzeEvidenceImage = useCallback(
    async (payload: {
      imageBase64?: string;
      mimeType?: string;
      assetPath?: string;
      complaintContext?: string;
    }): Promise<ImageAnalysisResult> => {
      if (isStaticModeRef.current) {
        throw new Error('Server-side Gemini AI image inspection requires running the Node/Express backend.');
      }
      const data = await authedFetch('/api/ai/analyze-image', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data.analysis as ImageAnalysisResult;
    },
    [authedFetch]
  );

  const requestOperationalBriefing = useCallback(
    async (payload: { query: string; complaintId?: string }): Promise<OperationalBriefingResult> => {
      if (isStaticModeRef.current) {
        throw new Error('Server-side Gemini AI operational briefing requires running the Node/Express backend.');
      }
      const data = await authedFetch('/api/ai/operational-briefing', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data.briefing as OperationalBriefingResult;
    },
    [authedFetch]
  );

  return (
    <PortalContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authSetupRequired,
        demoEnabled,
        demoAccounts,
        primaryAdminId,
        authError,
        clearAuthError,
        currentUser,
        complaints,
        departments,
        officers,
        users,
        activityLogs,
        notifications,
        settings,
        globalSearch,
        setGlobalSearch,
        toasts,
        dismissToast,
        addToast,
        loginWithCredentials,
        loginAsDemo,
        setupInitialCredentials,
        logout,
        refreshState,
        performComplaintAction,
        createDepartment,
        updateDepartment,
        createOfficer,
        updateOfficer,
        createUser,
        updateUser,
        updateSettings,
        markAllNotificationsRead,
        analyzeEvidenceImage,
        requestOperationalBriefing,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
};

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside PortalProvider');
  return ctx;
}
