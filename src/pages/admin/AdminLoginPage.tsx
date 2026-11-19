import { ArrowLeft, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, setAdminAuth } from '../../lib/api';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'credentials' | 'pin'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{
        token: string;
        admin: { name: string; role: string; email?: string };
      }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(
          mode === 'pin'
            ? { mode: 'pin', pin }
            : { mode: 'credentials', email, password }
        ),
      });
      setAdminAuth(res.token, res.admin);
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Autentikasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Portal Peserta Ujian
        </Link>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Login Administrator & Proktor
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akses terisolasi untuk pengelolaan ujian dan pemantauan peserta.
              </p>
            </div>
          </div>

          {/* Segmented Auth Mode */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('credentials');
                setError(null);
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'credentials'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Email & Sandi
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('pin');
                setError(null);
              }}
              className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'pin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              PIN Proktor Ruangan
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'credentials' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email / Username Admin
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@sekolah.sch.id"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  PIN Keamanan Proktor
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Masukkan PIN Proktor (6 digit)"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 font-mono text-sm tracking-widest"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Memverifikasi...' : 'Masuk Dashboard Proktor'}
            </button>
          </form>

          {/* Demo Credential Helper */}
          <div className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Kredensial Operator Bawaan:</span>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'pin') {
                    setPin('202601');
                  } else {
                    setEmail('admin@sekolah.sch.id');
                    setPassword('proktor2026');
                  }
                }}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Isi Otomatis
              </button>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              admin@sekolah.sch.id / proktor2026 · PIN: 202601
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
