import {
  Activity,
  Award,
  BookOpen,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminAuth, getAdminToken, getAdminUser } from '../../lib/api';
import { useThemeStore } from '../../store/themeStore';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { to: '/admin/monitoring', label: 'Monitoring Live', icon: Activity },
  { to: '/admin/soal', label: 'Bank Soal', icon: BookOpen },
  { to: '/admin/ujian', label: 'Paket & Jadwal', icon: ClipboardList },
  { to: '/admin/peserta', label: 'Data Peserta', icon: Users },
  { to: '/admin/nilai', label: 'Rekap Nilai', icon: Award },
  { to: '/admin/pengaturan', label: 'Pengaturan Sekolah', icon: Settings },
  { to: '/admin/supabase', label: 'Koneksi Supabase', icon: Database },
];

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const adminUser = getAdminUser();

  useEffect(() => {
    if (!getAdminToken()) {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate, location.pathname]);

  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));

  const handleLogout = () => {
    clearAdminAuth();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <Link to="/admin/dashboard" className="block">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Panel Proktor CBT
            </span>
          </Link>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            {adminUser?.name || 'Administrator'} · {adminUser?.role || 'Proktor'}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
          <Link
            to="/login"
            className="flex w-full items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Buka Portal Siswa
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar Proktor
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/60">
          <aside className="w-64 bg-white dark:bg-slate-900 flex flex-col h-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
              <span className="text-sm font-bold">Panel Proktor CBT</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-300'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 dark:border-slate-800 p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar Proktor
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 lg:px-8 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 dark:border-slate-700 p-2"
              aria-label="Buka Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
              <span>Admin CBT</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentNav?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Ubah Tema"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
