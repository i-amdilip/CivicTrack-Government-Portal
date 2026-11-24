import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SEED_SETTINGS } from '../data/seedData';
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
    if (!tokenRef.current) return;
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
    async function bootstrap() {
      try {
        const statusRes = await fetch('/api/auth/status');
        const statusData = await statusRes.json().catch(() => ({}));
        if (!mounted) return;
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
      } catch (err) {
        console.error('Portal bootstrap error:', err);
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
    [authedFetch, refreshState, addToast]
  );

  const createDepartment = useCallback(
    async (payload: Partial<Department>) => {
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
