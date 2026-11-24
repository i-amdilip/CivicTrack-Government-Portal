import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  FileText,
  Gauge,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { usePortal } from '../context/PortalContext';
import { hasPermission } from '../lib/rbac';
import { formatShortDate } from './StatusLabels';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  badge?: number;
  badgeTone?: 'neutral' | 'critical';
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

export const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    complaints,
    notifications,
    settings,
    globalSearch,
    setGlobalSearch,
    toasts,
    dismissToast,
    logout,
    markAllNotificationsRead,
  } = usePortal();

  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const counts = useMemo(() => {
    return {
      allCount: complaints.length,
      newCount: complaints.filter((c) => c.status === 'New' || c.status === 'Reviewed').length,
      pendingCount: complaints.filter((c) => c.status === 'Pending').length,
      inProgressCount: complaints.filter(
        (c) => c.status === 'In Progress' || c.status === 'Resolution Submitted'
      ).length,
      escalatedCount: complaints.filter((c) => c.status === 'Escalated').length,
    };
  }, [complaints]);

  const navGroups: NavGroup[] = useMemo(() => {
    if (!currentUser) return [];
    const role = currentUser.role;
    const isAdminOrSupervisory =
      role === 'Super Admin' || role === 'State Admin' || role === 'District Admin';

    const groups: NavGroup[] = [
      {
        heading: 'Overview',
        items: [
          {
            label: 'Dashboard',
            to: '/',
            icon: LayoutDashboard,
            visible: hasPermission(role, 'view_dashboard'),
          },
          {
            label: 'Live Monitoring',
            to: '/map',
            icon: MapIcon,
            visible: hasPermission(role, 'view_live_map'),
          },
        ],
      },
      {
        heading: 'Complaints',
        items: [
          {
            label: 'All Complaints',
            to: '/complaints',
            icon: FileText,
            visible: true,
            badge: counts.allCount,
            badgeTone: 'neutral',
          },
          {
            label: 'New Reports',
            to: '/complaints/new',
            icon: Inbox,
            visible: isAdminOrSupervisory,
            badge: counts.newCount > 0 ? counts.newCount : undefined,
            badgeTone: 'neutral',
          },
          {
            label: 'Pending',
            to: '/complaints/pending',
            icon: Clock,
            visible: true,
            badge: counts.pendingCount > 0 ? counts.pendingCount : undefined,
            badgeTone: 'neutral',
          },
          {
            label: 'In Progress',
            to: '/complaints/in-progress',
            icon: ClipboardList,
            visible: true,
            badge: counts.inProgressCount > 0 ? counts.inProgressCount : undefined,
            badgeTone: 'neutral',
          },
          {
            label: 'Resolved',
            to: '/complaints/resolved',
            icon: CheckCircle2,
            visible: true,
          },
          {
            label: 'Escalated & SLA',
            to: '/complaints/escalated',
            icon: AlertTriangle,
            visible: true,
            badge: counts.escalatedCount > 0 ? counts.escalatedCount : undefined,
            badgeTone: 'critical',
          },
          {
            label: 'Assign Complaints',
            to: '/assign',
            icon: UserCheck,
            visible: hasPermission(role, 'assign_complaint'),
          },
        ],
      },
      {
        heading: 'Departments & Staff',
        items: [
          {
            label: 'Departments',
            to: '/departments',
            icon: Building2,
            visible: hasPermission(role, 'view_departments'),
          },
          {
            label: 'Officers & Staff',
            to: '/staff',
            icon: Users,
            visible: hasPermission(role, 'view_staff'),
          },
        ],
      },
      {
        heading: 'Reports & Audit',
        items: [
          {
            label: 'Analytics & Reports',
            to: '/analytics',
            icon: BarChart3,
            visible: hasPermission(role, 'view_analytics'),
          },
          {
            label: 'Performance',
            to: '/performance',
            icon: Gauge,
            visible: hasPermission(role, 'view_performance'),
          },
          {
            label: 'Activity Logs',
            to: '/activity-logs',
            icon: Activity,
            visible: hasPermission(role, 'view_activity_logs'),
          },
        ],
      },
      {
        heading: 'Administration',
        items: [
          {
            label: 'User Management',
            to: '/users',
            icon: ShieldAlert,
            visible: hasPermission(role, 'manage_users'),
          },
          {
            label: 'Settings',
            to: '/settings',
            icon: Settings,
            visible: hasPermission(role, 'manage_settings'),
          },
        ],
      },
    ];

    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.visible),
      }))
      .filter((g) => g.items.length > 0);
  }, [currentUser, counts]);

  const routeMeta = useMemo(() => {
    const p = location.pathname;
    if (p === '/') return { title: 'Overview', crumbs: ['Overview', 'Dashboard'] };
    if (p === '/complaints')
      return { title: 'All Complaints', crumbs: ['Complaints', 'All Complaints'] };
    if (p === '/complaints/new')
      return { title: 'New Reports', crumbs: ['Complaints', 'New Reports'] };
    if (p === '/complaints/pending')
      return { title: 'Pending Complaints', crumbs: ['Complaints', 'Pending'] };
    if (p === '/complaints/in-progress')
      return { title: 'In Progress Complaints', crumbs: ['Complaints', 'In Progress'] };
    if (p === '/complaints/resolved')
      return { title: 'Resolved Complaints', crumbs: ['Complaints', 'Resolved'] };
    if (p === '/complaints/escalated')
      return {
        title: 'Escalated & SLA',
        crumbs: ['Complaints', 'Escalated & SLA'],
      };
    if (p.startsWith('/complaints/')) {
      const id = p.replace('/complaints/', '');
      return {
        title: `Complaint ${id}`,
        crumbs: ['Complaints', id],
      };
    }
    if (p === '/assign')
      return { title: 'Assign Complaints', crumbs: ['Complaints', 'Assignment'] };
    if (p === '/map') return { title: 'Live Monitoring', crumbs: ['Overview', 'Live Map'] };
    if (p === '/departments')
      return { title: 'Departments', crumbs: ['Operations', 'Departments'] };
    if (p === '/staff')
      return { title: 'Officers & Staff', crumbs: ['Operations', 'Officers & Staff'] };
    if (p === '/analytics')
      return { title: 'Analytics & Reports', crumbs: ['Reports', 'Analytics'] };
    if (p === '/performance')
      return { title: 'Performance', crumbs: ['Reports', 'Performance'] };
    if (p === '/activity-logs')
      return { title: 'Activity Logs', crumbs: ['Reports', 'Activity Logs'] };
    if (p === '/users')
      return { title: 'User Management', crumbs: ['Administration', 'Users'] };
    if (p === '/settings')
      return { title: 'Settings', crumbs: ['Administration', 'Settings'] };
    return { title: 'CivicTrack Portal', crumbs: ['Portal'] };
  }, [location.pathname]);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.pathname.startsWith('/complaints')) {
      navigate('/complaints');
    }
  };

  const canAccessSettings = currentUser ? hasPermission(currentUser.role, 'manage_settings') : false;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0044B3] text-white select-none">
      {/* Brand Seal & Title */}
      <div className="flex h-16 items-center justify-between px-5 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-3 min-w-0"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#F59E0B]/80 bg-[#00338D] text-[#FDE68A] shadow-sm shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white leading-none truncate">
              CivicTrack
            </div>
            <div className="mt-1 text-[11px] font-medium text-white/75 leading-none truncate">
              Municipal GIS
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav
        className="sidebar-scroll flex-1 overflow-y-auto pl-3.5 py-3 space-y-4"
        aria-label="Portal Navigation"
      >
        {navGroups.map((group, idx) => (
          <div key={group.heading} className={idx > 0 ? 'pt-1' : ''}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-white/55">
              {group.heading}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/' || item.to === '/complaints'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between py-2.5 pl-3.5 pr-4 text-[13px] transition-all duration-150 ${
                          isActive
                            ? 'rounded-l-xl bg-[#EFF2F7] font-semibold text-[#0044B3] shadow-xs'
                            : 'rounded-l-xl font-medium text-white/85 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? 'text-[#0044B3]' : 'text-white/80'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className={`ml-2 font-mono-tabular text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                                item.badgeTone === 'critical'
                                  ? 'bg-[#EF4444] text-white'
                                  : isActive
                                  ? 'bg-[#0044B3]/10 text-[#0044B3]'
                                  : 'bg-white/15 text-white'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Official Profile & Logout */}
      {currentUser && (
        <div className="border-t border-white/15 p-4 shrink-0">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white shrink-0">
              {currentUser.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-white/75 truncate">{currentUser.designation}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#EFF2F7] text-[#1E293B]">
      {/* Desktop Cobalt Sidebar */}
      <aside className="hidden lg:block lg:w-60 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0F172A]/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 max-w-[82vw] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Navigation Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#E2E8F0] bg-[#EFF2F7]/95 backdrop-blur-sm px-4 sm:px-7">
          <div className="flex w-full items-center justify-between gap-4">
            {/* Left: Mobile Trigger + Title + Search */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#1E293B] hover:bg-[#F8FAFC] lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-[#1E293B] leading-tight truncate">
                  {routeMeta.title}
                </h1>
                <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#64748B] leading-none mt-0.5">
                  <span>CivicTrack</span>
                  {routeMeta.crumbs.map((crumb) => (
                    <React.Fragment key={crumb}>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">{crumb}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleGlobalSearchSubmit}
                className="hidden md:block relative ml-4 w-full max-w-xs"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search ID, ward, or issue..."
                  aria-label="Global complaint search"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#E4E8EF]/80 py-2 pl-9 pr-3 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#0044B3] focus:bg-white focus:outline-none transition-colors"
                />
              </form>
            </div>

            {/* Right: Jurisdiction, Notifications, Settings, Profile */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden xl:flex flex-col items-end border-r border-[#CBD5E1] pr-3 text-right leading-tight">
                <span className="text-[10px] font-medium text-[#64748B]">Jurisdiction</span>
                <span className="text-xs font-semibold text-[#1E293B]">
                  {currentUser?.jurisdiction || settings.administrativeRegion}
                </span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setProfileOpen(false);
                  }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F59E0B] px-1 font-mono-tabular text-[10px] font-bold text-[#1E293B] shadow-xs">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#E2E8F0] bg-white shadow-xl z-40 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
                      <span className="text-xs font-semibold text-[#1E293B]">
                        Operational Notifications
                      </span>
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-semibold text-[#0044B3] hover:underline"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-72 divide-y divide-[#E2E8F0] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[#64748B]">
                          No active notifications for your scope.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              if (n.complaintId) navigate(`/complaints/${n.complaintId}`);
                            }}
                            className={`block w-full px-4 py-3 text-left hover:bg-[#F8FAFC] ${
                              !n.read ? 'bg-[#EFF6FF]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-xs font-semibold ${
                                  n.severity === 'critical'
                                    ? 'text-[#DC2626]'
                                    : n.severity === 'warning'
                                    ? 'text-[#D97706]'
                                    : 'text-[#1E293B]'
                                }`}
                              >
                                {n.title}
                              </span>
                              <span className="text-[10px] text-[#64748B] whitespace-nowrap">
                                {formatShortDate(n.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#64748B] line-clamp-2">
                              {n.detail}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Settings Shortcut (only when permitted) */}
              {canAccessSettings && (
                <Link
                  to="/settings"
                  aria-label="System Settings"
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              )}

              {/* Official Profile Dropdown & Role Switcher */}
              {currentUser && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen((v) => !v);
                      setNotifOpen(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-left hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0044B3] text-[11px] font-bold text-white shrink-0">
                      {currentUser.name
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="hidden sm:block leading-tight">
                      <div className="text-xs font-semibold text-[#1E293B] whitespace-nowrap">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] font-medium text-[#64748B] whitespace-nowrap">
                        {currentUser.role}
                      </div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#E2E8F0] bg-white shadow-xl z-40 overflow-hidden">
                      <div className="border-b border-[#E2E8F0] px-4 py-3 bg-[#F8FAFC]">
                        <div className="text-xs font-semibold text-[#1E293B]">
                          {currentUser.name}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {currentUser.employeeId} · {currentUser.role}
                        </div>
                        <div className="text-[11px] text-[#64748B]">{currentUser.email}</div>
                        <div className="mt-1 text-[10px] text-[#64748B]">
                          Jurisdiction: {currentUser.jurisdiction}
                        </div>
                      </div>

                      <div className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out of Portal</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-2 rounded-xl border bg-white p-3.5 shadow-lg ${
                t.type === 'error'
                  ? 'border-[#FECACA]'
                  : t.type === 'success'
                  ? 'border-[#A7F3D0]'
                  : 'border-[#BFDBFE]'
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold ${
                    t.type === 'error'
                      ? 'text-[#DC2626]'
                      : t.type === 'success'
                      ? 'text-[#059669]'
                      : 'text-[#0044B3]'
                  }`}
                >
                  {t.title}
                </div>
                {t.message && <p className="mt-0.5 text-[11px] text-[#64748B]">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-[#64748B] hover:text-[#1E293B]"
                aria-label="Dismiss message"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
