import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

interface SanitizedSupabaseConfig {
  supabase_url: string;
  storage_bucket: string;
  is_enabled: boolean;
  source: 'env' | 'admin_db' | 'mixed' | 'unconfigured';
  has_anon_key: boolean;
  has_service_key: boolean;
  anon_key_preview: string;
  service_key_preview: string;
  last_tested_at: string | null;
  last_status: string;
  last_message: string;
  auto_sync_active: boolean;
  startup_hydrated: boolean;
  last_auto_sync_at: string | null;
}

interface TestResult {
  ok: boolean;
  latency_ms: number;
  message: string;
  tables: Array<{ name: string; ready: boolean; detail: string }>;
  storage_ready: boolean;
  storage_detail: string;
}

export const AdminSupabasePage: React.FC = () => {
  const [config, setConfig] = useState<SanitizedSupabaseConfig | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [storageBucket, setStorageBucket] = useState('cbt-assets');
  const [isEnabled, setIsEnabled] = useState(false);

  const [sqlBlueprint, setSqlBlueprint] = useState('');
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, sqlRes] = await Promise.all([
        apiFetch<{ config: SanitizedSupabaseConfig }>('/api/admin/supabase/config', {
          admin: true,
        }),
        apiFetch<{ sql: string }>('/api/admin/schema-sql', { admin: true }),
      ]);
      setConfig(cfgRes.config);
      setSupabaseUrl(cfgRes.config.supabase_url);
      setStorageBucket(cfgRes.config.storage_bucket || 'cbt-assets');
      setIsEnabled(cfgRes.config.is_enabled);
      setSqlBlueprint(sqlRes.sql);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ config: SanitizedSupabaseConfig }>(
        '/api/admin/supabase/config',
        {
          method: 'PUT',
          admin: true,
          body: JSON.stringify({
            supabase_url: supabaseUrl.trim(),
            supabase_anon_key: anonKey.trim() || undefined,
            supabase_service_key: serviceKey.trim() || undefined,
            storage_bucket: storageBucket.trim() || 'cbt-assets',
            is_enabled: isEnabled,
          }),
        }
      );
      setConfig(res.config);
      setAnonKey('');
      setServiceKey('');
      setFeedback({
        type: 'success',
        text: 'Konfigurasi koneksi API Supabase berhasil disimpan dengan aman di server.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal menyimpan konfigurasi Supabase.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await apiFetch<TestResult & { config: SanitizedSupabaseConfig }>(
        '/api/admin/supabase/test',
        {
          method: 'POST',
          admin: true,
          body: JSON.stringify({
            supabase_url: supabaseUrl.trim() || undefined,
            supabase_anon_key: anonKey.trim() || undefined,
            supabase_service_key: serviceKey.trim() || undefined,
            storage_bucket: storageBucket.trim() || undefined,
          }),
        }
      );
      setTestResult(res);
      setConfig(res.config);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal menguji koneksi ke Supabase.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePushSync = async () => {
    setSyncing('push');
    setFeedback(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        total_rows: number;
        summary: Array<{ table: string; count: number }>;
        config: SanitizedSupabaseConfig;
      }>('/api/admin/supabase/sync-push', {
        method: 'POST',
        admin: true,
      });
      setConfig(res.config);
      setFeedback({
        type: 'success',
        text: `Berhasil mengirim ${res.total_rows} baris data lokal ke 7 tabel PostgreSQL Supabase.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal mengirim sinkronisasi ke Supabase.',
      });
    } finally {
      setSyncing(null);
    }
  };

  const handlePullSync = async () => {
    setSyncing('pull');
    setFeedback(null);
    try {
      const res = await apiFetch<{
        ok: boolean;
        pulled: {
          institution_settings: number;
          exams: number;
          participants: number;
          questions: number;
          exam_sessions?: number;
          exam_results?: number;
        };
      }>('/api/admin/supabase/sync-pull', {
        method: 'POST',
        admin: true,
      });
      setFeedback({
        type: 'success',
        text: `Berhasil menarik data dari Supabase (${res.pulled.exams} paket ujian, ${res.pulled.participants} peserta, ${res.pulled.questions} soal, ${res.pulled.exam_results ?? 0} hasil ujian).`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Gagal menarik data dari Supabase.',
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlBlueprint], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cbt_supabase_postgres_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Koneksi & Integrasi Database Supabase
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Hubungkan sistem CBT ke proyek Supabase PostgreSQL & Storage Bucket melalui jalur
            server-side terenkripsi.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Menguji Koneksi...' : 'Uji Koneksi & Cek 7 Tabel'}
          </button>
        </div>
      </div>

      {/* AI Studio Persistence Notice */}
      {config && (
        <div
          className={`rounded-xl border p-4 text-xs space-y-2 ${
            config.source === 'env' || config.source === 'mixed'
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-amber-300 bg-amber-50/70 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold flex items-center gap-2">
              {config.source === 'env' || config.source === 'mixed' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Mode Permanen Aktif (AI Studio Secrets + Sinkronisasi Otomatis)
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  Agar Koneksi &amp; Data Tidak Hilang Setiap Login Ulang ke AI Studio
                </>
              )}
            </p>
            {config.auto_sync_active && (
              <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Auto-Sync Aktif
              </span>
            )}
          </div>
          {config.source === 'env' || config.source === 'mixed' ? (
            <p className="leading-relaxed">
              Kredensial Supabase terdeteksi dari <strong>AI Studio Secrets / Environment</strong>.
              Setiap kali server menyala, seluruh data peserta, soal, paket ujian, dan hasil
              otomatis dimuat dari Supabase, dan setiap perubahan langsung tersimpan ke Supabase.
            </p>
          ) : (
            <div className="space-y-1.5 leading-relaxed">
              <p>
                Penyimpanan lokal container (<code className="font-mono">./data/cbt.db</code>)
                bersifat sementara dan akan ter-reset saat sesi AI Studio dimulai ulang. Agar data
                &amp; koneksi Supabase <strong>permanen otomatis setiap login</strong>, simpan 4
                variabel berikut di panel <strong>Secrets</strong> (ikon kunci di sidebar kiri AI
                Studio):
              </p>
              <div className="flex flex-wrap gap-2 font-mono text-[11px] pt-1">
                <code className="rounded bg-white/80 dark:bg-slate-900 px-2 py-0.5 border border-amber-300 dark:border-amber-800">
                  SUPABASE_URL
                </code>
                <code className="rounded bg-white/80 dark:bg-slate-900 px-2 py-0.5 border border-amber-300 dark:border-amber-800">
                  SUPABASE_ANON_KEY
                </code>
                <code className="rounded bg-white/80 dark:bg-slate-900 px-2 py-0.5 border border-amber-300 dark:border-amber-800">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>
                <code className="rounded bg-white/80 dark:bg-slate-900 px-2 py-0.5 border border-amber-300 dark:border-amber-800">
                  SUPABASE_STORAGE_BUCKET
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Summary Strip */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Status Koneksi</span>
              <Database className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {config.last_status === 'connected' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    Terhubung ke Supabase
                  </span>
                </>
              ) : config.last_status === 'error' ? (
                <>
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    Perlu Verifikasi Skema
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Belum Dikonfigurasi
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {config.last_message || 'Simpan kredensial lalu klik Uji Koneksi.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Keamanan Kunci API</span>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {config.has_service_key
                ? 'Service Role Key Tersimpan'
                : config.has_anon_key
                  ? 'Hanya Anon Key Tersimpan'
                  : 'Kunci Belum Diatur'}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Sumber:{' '}
              {config.source === 'env'
                ? 'AI Studio Secrets (.env)'
                : config.source === 'admin_db'
                  ? 'SQLite Sementara (Admin UI)'
                  : config.source === 'mixed'
                    ? 'Admin + AI Studio Secrets'
                    : 'Kosong'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Sinkronisasi Database</span>
              <KeyRound className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={syncing !== null || !config.has_service_key || !config.supabase_url}
                onClick={handlePushSync}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                {syncing === 'push' ? 'Mengirim...' : 'Push ke Supabase'}
              </button>
              <button
                type="button"
                disabled={syncing !== null || !config.has_service_key || !config.supabase_url}
                onClick={handlePullSync}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                {syncing === 'pull' ? 'Menarik...' : 'Tarik dari Supabase'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {config.auto_sync_active
                ? 'Auto-sync aktif pada setiap perubahan data.'
                : 'Migrasi & sinkronisasi instan antar server.'}
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Supabase API Settings Form */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Pengaturan Koneksi API Supabase (Server-Side)
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kunci API disimpan secara eksklusif di sisi server dan tidak pernah dikirim ulang ke
            peramban peserta. Biarkan kolom kunci kosong jika tidak ingin mengganti kunci yang
            sudah tersimpan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Supabase Project URL
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://abcdefghijkl.supabase.co"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Storage Bucket
            </label>
            <input
              type="text"
              required
              value={storageBucket}
              onChange={(e) => setStorageBucket(e.target.value)}
              placeholder="cbt-assets"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Anon / Publishable Key
              </label>
              {config?.has_anon_key && (
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Tersimpan ({config.anon_key_preview})
                </span>
              )}
            </div>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder={
                config?.has_anon_key
                  ? 'Kosongkan untuk mempertahankan kunci saat ini'
                  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Service Role Secret Key (Wajib untuk Sync Server)
              </label>
              {config?.has_service_key && (
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Tersimpan ({config.service_key_preview})
                </span>
              )}
            </div>
            <input
              type="password"
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              placeholder={
                config?.has_service_key
                  ? 'Kosongkan untuk mempertahankan kunci saat ini'
                  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              }
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="inline-flex items-center gap-2.5 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            Aktifkan Profil Koneksi Supabase untuk Sinkronisasi Cloud
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan API'}
          </button>
        </div>
      </form>

      {/* Live Diagnostics Result */}
      {testResult && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hasil Diagnostik Tabel & Storage Supabase
            </h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Latensi: {testResult.latency_ms}ms
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">{testResult.message}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {testResult.tables.map((t) => (
              <div
                key={t.name}
                className={`rounded-lg border p-3 text-xs ${
                  t.ready
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30'
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-mono font-semibold">
                  <span className="truncate">{t.name}</span>
                  {t.ready ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {t.detail}
                </p>
              </div>
            ))}

            <div
              className={`rounded-lg border p-3 text-xs ${
                testResult.storage_ready
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-center justify-between gap-1 font-mono font-semibold">
                <span className="truncate">bucket: {storageBucket}</span>
                {testResult.storage_ready ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {testResult.storage_detail}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step-by-Step Guide & SQL Schema Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-600" />
              Panduan Tahap Demi Tahap Koneksi Database Supabase
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ikuti 6 langkah berikut untuk menyiapkan proyek Supabase hingga tersinkronisasi penuh.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSql((v) => !v)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {showSql ? 'Sembunyikan Skrip SQL' : 'Lihat Skrip SQL'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh .SQL
            </button>
          </div>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 1. Buat Proyek Baru di Supabase
            </p>
            <p>
              Masuk ke dasbor Supabase, klik <strong>New Project</strong>, pilih region terdekat
              (misal: <code className="font-mono">ap-southeast-1 Singapore</code>), dan tunggu proses
              inisialisasi selesai.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 2. Eksekusi Skrip SQL DDL (7 Tabel + RLS + Bucket)
            </p>
            <p>
              Buka menu <strong>SQL Editor &rarr; New Query</strong> pada Supabase, tempel seluruh
              skrip SQL dari tombol <em>Lihat Skrip SQL</em> / <em>Unduh .SQL</em>, lalu klik{' '}
              <strong>Run</strong>.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 3. Salin URL & Kunci API Proyek
            </p>
            <p>
              Buka <strong>Project Settings &rarr; API</strong>. Salin <strong>Project URL</strong>
              , kunci <strong>anon (public)</strong>, serta kunci rahasia{' '}
              <strong>service_role</strong>.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 4. Simpan Kredensial di Halaman Ini (atau .env)
            </p>
            <p>
              Masukkan URL dan kedua kunci pada form di atas lalu klik{' '}
              <strong>Simpan Pengaturan API</strong>, atau definisikan pada variabel{' '}
              <code className="font-mono">SUPABASE_URL</code> dan{' '}
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> di lingkungan server.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 5. Uji Koneksi & Verifikasi 7 Tabel
            </p>
            <p>
              Klik tombol <strong>Uji Koneksi & Cek 7 Tabel</strong> di kanan atas untuk memastikan
              seluruh tabel PostgreSQL dan Storage Bucket <code className="font-mono">cbt-assets</code>{' '}
              berstatus hijau siap digunakan.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Tahap 6. Push Data Awal / Pull Sinkronisasi
            </p>
            <p>
              Klik <strong>Push ke Supabase</strong> untuk mengunggah pengaturan sekolah, paket
              ujian, peserta, dan bank soal ke Supabase secara otomatis dalam satu klik.
            </p>
          </li>
        </ol>

        {showSql && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sqlBlueprint);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
            >
              <Copy className="h-3 w-3" />
              {copiedSql ? 'Tersalin' : 'Salin SQL'}
            </button>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200">
              {sqlBlueprint}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
