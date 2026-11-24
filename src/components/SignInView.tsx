import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Landmark,
  Lock,
  Play,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { usePortal } from '../context/PortalContext';

export const SignInView: React.FC = () => {
  const {
    authSetupRequired,
    demoEnabled,
    demoAccounts,
    primaryAdminId,
    authError,
    clearAuthError,
    loginWithCredentials,
    loginAsDemo,
    setupInitialCredentials,
    settings,
    isLoading,
  } = usePortal();

  const [activeTab, setActiveTab] = useState<'login' | 'setup'>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Demo role state
  const [selectedDemoId, setSelectedDemoId] = useState('usr-1');

  // First-run setup form state
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [initializeAllSeeded, setInitializeAllSeeded] = useState(true);
  const [initializedIds, setInitializedIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (demoAccounts.length > 0 && !demoAccounts.some((a) => a.id === selectedDemoId)) {
      setSelectedDemoId(demoAccounts[0].id);
    }
  }, [demoAccounts, selectedDemoId]);

  useEffect(() => {
    if (!authSetupRequired && activeTab === 'setup') {
      setActiveTab('login');
    }
  }, [authSetupRequired, activeTab]);

  const displayedError = localError || authError;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!identifier.trim()) {
      setLocalError('Please enter your Official Employee ID or Government Email.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your portal password.');
      return;
    }

    await loginWithCredentials(identifier.trim(), password);
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (setupPassword.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== confirmPassword) {
      setLocalError('Password and confirmation do not match.');
      return;
    }

    const ids = await setupInitialCredentials({
      password: setupPassword,
      confirmPassword,
      initializeAllSeeded,
    });
    if (ids) {
      setInitializedIds(ids);
      setIdentifier(ids[0] || primaryAdminId);
      setPassword('');
      setSetupPassword('');
      setConfirmPassword('');
      setActiveTab('login');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#EFF2F7] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
        {/* Official Municipal Header */}
        <div className="bg-[#0044B3] px-6 py-5 text-white">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#F59E0B]/80 bg-[#00338D] text-[#FDE68A] shrink-0">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-snug">
                CivicTrack — Government Administration Portal
              </h1>
              <p className="text-xs text-white/80 truncate">{settings.municipalityName}</p>
            </div>
          </div>
        </div>

        {/* Mode Switcher when Initial Setup is available */}
        {authSetupRequired && (
          <div className="grid grid-cols-2 border-b border-[#E2E8F0] bg-[#F8FAFC] p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLocalError(null);
                clearAuthError();
              }}
              className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                activeTab === 'login'
                  ? 'bg-white text-[#0044B3] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              Official ID & Password
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('setup');
                setLocalError(null);
                clearAuthError();
              }}
              className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                activeTab === 'setup'
                  ? 'bg-white text-[#0044B3] shadow-xs border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              Set Initial Password
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {activeTab === 'setup' && authSetupRequired ? (
            <>
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 text-xs text-[#1E3A8A]">
                <div className="flex items-center gap-2 font-semibold text-[#0044B3]">
                  <KeyRound className="h-4 w-4 shrink-0" />
                  <span>First-Run Official Credential Setup</span>
                </div>
                <p className="mt-1 leading-relaxed text-[#334155]">
                  Set an initial password for the Super Admin account below so you can sign in using
                  your Official ID and Password.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-[#64748B]">Primary Official ID</span>
                  <div className="mt-0.5 font-semibold text-[#1E293B]">
                    Dr. Arvind Menon · Super Admin
                  </div>
                </div>
                <span className="rounded-lg bg-[#0044B3]/10 px-2.5 py-1 font-mono-tabular text-xs font-bold text-[#0044B3]">
                  {primaryAdminId}
                </span>
              </div>

              {displayedError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#B91C1C]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              <form onSubmit={handleSetupSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="setup-password"
                    className="block text-xs font-semibold text-[#1E293B] mb-1.5"
                  >
                    New Portal Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="setup-password"
                      type={showSetupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={setupPassword}
                      onChange={(e) => {
                        setSetupPassword(e.target.value);
                        setLocalError(null);
                        clearAuthError();
                      }}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-10 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:border-[#0044B3] focus:outline-none focus:ring-2 focus:ring-[#0044B3]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword((v) => !v)}
                      aria-label={showSetupPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B]"
                    >
                      {showSetupPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-semibold text-[#1E293B] mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="confirm-password"
                      type={showSetupPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setLocalError(null);
                        clearAuthError();
                      }}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:border-[#0044B3] focus:outline-none focus:ring-2 focus:ring-[#0044B3]/15"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initializeAllSeeded}
                    onChange={(e) => setInitializeAllSeeded(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#0044B3] focus:ring-[#0044B3]"
                  />
                  <span>
                    Also initialize the seeded role accounts (
                    <span className="font-mono-tabular font-medium text-[#1E293B]">
                      ADM-014, ADM-029, EMP-2104, EMP-2167
                    </span>
                    ) with this password for multi-role login.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0044B3] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003591] disabled:opacity-60 transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{isLoading ? 'Initializing...' : 'Save Password & Continue'}</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569]">
                Authorized Municipal Officials Only. Sign in with your{' '}
                <span className="font-semibold text-[#1E293B]">Official ID / Email</span> and{' '}
                <span className="font-semibold text-[#1E293B]">Password</span>
                {demoEnabled ? ', or launch a role-scoped demo session below.' : '.'}
              </div>

              {initializedIds && (
                <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-xs text-[#065F46]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Credentials Ready</span>
                  </div>
                  <p className="mt-1">
                    Active IDs:{' '}
                    <span className="font-mono-tabular font-semibold">
                      {initializedIds.join(', ')}
                    </span>
                  </p>
                </div>
              )}

              {displayedError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#B91C1C]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="official-id"
                    className="block text-xs font-semibold text-[#1E293B] mb-1.5"
                  >
                    Official ID or Email
                  </label>
                  <div className="relative">
                    <BadgeCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="official-id"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setLocalError(null);
                        clearAuthError();
                      }}
                      placeholder="e.g. ADM-001 or a.menon@delhicivic.gov.in"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:border-[#0044B3] focus:outline-none focus:ring-2 focus:ring-[#0044B3]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="official-password"
                    className="block text-xs font-semibold text-[#1E293B] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <input
                      id="official-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLocalError(null);
                        clearAuthError();
                      }}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white py-2.5 pl-9 pr-10 text-sm text-[#1E293B] placeholder:text-[#94A3B8] focus:border-[#0044B3] focus:outline-none focus:ring-2 focus:ring-[#0044B3]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#1E293B]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0044B3] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003591] disabled:opacity-60 transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  <span>{isLoading ? 'Verifying Credentials...' : 'Sign In with ID & Password'}</span>
                </button>
              </form>

              {authSetupRequired && (
                <div className="text-center text-[11px] text-[#64748B]">
                  Need to configure your password first?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('setup');
                      setLocalError(null);
                      clearAuthError();
                    }}
                    className="font-semibold text-[#0044B3] hover:underline"
                  >
                    Set Initial Password
                  </button>
                </div>
              )}

              {/* Instant One-Click Demo Login (No Credentials Required) */}
              {demoEnabled && (
                <div className="pt-1 space-y-3">
                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-[#E2E8F0]" />
                    <span className="mx-3 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Or Testing Mode
                    </span>
                    <div className="flex-grow border-t border-[#E2E8F0]" />
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => loginAsDemo(selectedDemoId)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0044B3] bg-[#EFF6FF] px-4 py-2.5 text-sm font-semibold text-[#0044B3] hover:bg-[#DBEAFE] disabled:opacity-60 transition-colors"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Demo Login (No ID / Password)</span>
                  </button>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                    <label
                      htmlFor="demo-role-select"
                      className="text-[11px] font-medium text-[#64748B] whitespace-nowrap"
                    >
                      Demo Role:
                    </label>
                    <select
                      id="demo-role-select"
                      aria-label="Select demo official role"
                      value={selectedDemoId}
                      onChange={(e) => setSelectedDemoId(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-right text-xs font-semibold text-[#1E293B] focus:outline-none"
                    >
                      {demoAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.role} — {acc.name} ({acc.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5 text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0044B3]" />
            <span>Role-Based Access Enforced</span>
          </span>
          <span className="font-mono-tabular">Portal Code: {settings.portalCode}</span>
        </div>
      </div>
    </div>
  );
};
