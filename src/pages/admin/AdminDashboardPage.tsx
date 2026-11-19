import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import type { InstitutionSettings, SessionStatus } from '../../types/cbt';

interface DashboardData {
  institution: InstitutionSettings;
  stats: {
    total_participants: number;
    total_exams: number;
    active_exams: number;
    total_questions: number;
    in_progress: number;
    completed: number;
    flagged_cheating: number;
  };
  recent_alerts: Array<{
    session_id: number;
    exam_number: string;
    full_name: string;
    class_name: string;
    exam_title: string;
    status: SessionStatus;
    violations_count: number;
    last_synced_at: string;
  }>;
}

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardData>('/api/admin/dashboard', { admin: true })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Institution Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-4">
          {data.institution.logo_url && (
            <img
              src={data.institution.logo_url}
              alt={data.institution.school_name}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white object-contain p-1"
            />
          )}
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.institution.exam_event_name} · Tahun Pelajaran {data.institution.academic_year}
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
              {data.institution.school_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/admin/monitoring"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Activity className="h-4 w-4" />
            Buka Monitoring Live
          </Link>
          <Link
            to="/admin/pengaturan"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            Pengaturan
          </Link>
        </div>
      </div>

      {/* 4 Key Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Peserta Aktif</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {data.stats.total_participants}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Terdaftar dalam basis data ujian
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Paket & Bank Soal</span>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {data.stats.active_exams} / {data.stats.total_exams}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Paket aktif · {data.stats.total_questions} butir soal tersedia
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Sesi Berlangsung & Selesai</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {data.stats.in_progress} · {data.stats.completed}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sedang mengerjakan · Selesai normal
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Pelanggaran Batas</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {data.stats.flagged_cheating}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Peserta terkunci oleh AntiCheatGuard
          </p>
        </div>
      </div>

      {/* Quick Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/soal"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-blue-400 transition-colors"
        >
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            Kelola Bank Soal KaTeX
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tambah soal eksakta matematika/fisika/kimia beserta gambar stimulus terkompresi.
          </p>
        </Link>
        <Link
          to="/admin/peserta"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-blue-400 transition-colors"
        >
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            Import Peserta & Cetak Kartu
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unggah data peserta massal dari Excel dan cetak kartu peserta PDF otomatis.
          </p>
        </Link>
        <Link
          to="/admin/nilai"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-blue-400 transition-colors"
        >
          <Award className="h-5 w-5 text-amber-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            Rekapitulasi & Ekspor Nilai
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Unduh matriks nilai lengkap ke Excel (.xlsx) atau laporan resmi PDF siap cetak.
          </p>
        </Link>
      </div>

      {/* Security Alerts Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Catatan Aktivitas Pelanggaran Terkini
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Peserta dengan catatan perpindahan tab atau keluar layar penuh.
            </p>
          </div>
          <Link
            to="/admin/monitoring"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Kelola Reset Sesi
          </Link>
        </div>

        {data.recent_alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada catatan pelanggaran keamanan pada sesi ujian saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3 font-semibold">No. Peserta</th>
                  <th className="px-5 py-3 font-semibold">Nama Lengkap</th>
                  <th className="px-5 py-3 font-semibold">Kelas</th>
                  <th className="px-5 py-3 font-semibold">Paket Ujian</th>
                  <th className="px-5 py-3 font-semibold text-right">Pelanggaran</th>
                  <th className="px-5 py-3 font-semibold">Status Sesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recent_alerts.map((row) => (
                  <tr key={row.session_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-semibold">{row.exam_number}</td>
                    <td className="px-5 py-3 font-medium">{row.full_name}</td>
                    <td className="px-5 py-3">{row.class_name}</td>
                    <td className="px-5 py-3">{row.exam_title}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {row.violations_count}x
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {row.status === 'flagged_cheating' ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          Dicurigai Curang (Terkunci)
                        </span>
                      ) : row.status === 'completed' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Selesai</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Peringatan Aktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
