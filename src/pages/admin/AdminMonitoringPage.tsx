import {
  CheckCircle2,
  Eye,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { Exam, MonitoringEntry } from '../../types/cbt';

interface MonitoringResponse {
  exam: { id: number; title: string; subject_name: string };
  summary: {
    total_registered: number;
    in_progress: number;
    completed: number;
    flagged_cheating: number;
    not_started: number;
  };
  rows: MonitoringEntry[];
}

export const AdminMonitoringPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logModalEntry, setLogModalEntry] = useState<MonitoringEntry | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const fetchMonitoring = useCallback(async (examId: number) => {
    if (!examId) return;
    try {
      const res = await apiFetch<MonitoringResponse>(
        `/api/admin/monitoring?exam_id=${examId}`,
        { admin: true }
      );
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch<{ exams: Exam[] }>('/api/admin/exams', { admin: true })
      .then((res) => {
        setExams(res.exams);
        if (res.exams.length > 0) {
          setSelectedExamId(res.exams[0].id);
          void fetchMonitoring(res.exams[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [fetchMonitoring]);

  // Real-time 3-second polling
  useEffect(() => {
    if (!autoRefresh || !selectedExamId) return;
    const interval = window.setInterval(() => {
      void fetchMonitoring(selectedExamId);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, selectedExamId, fetchMonitoring]);

  const handleResetSession = async (sessionId: number) => {
    setActionBusyId(sessionId);
    try {
      await apiFetch(`/api/admin/sessions/${sessionId}/reset`, {
        method: 'POST',
        admin: true,
      });
      await fetchMonitoring(selectedExamId);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleForceFinish = async (sessionId: number) => {
    setActionBusyId(sessionId);
    try {
      await apiFetch(`/api/admin/sessions/${sessionId}/force-finish`, {
        method: 'POST',
        admin: true,
      });
      await fetchMonitoring(selectedExamId);
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Monitoring Live & Reset Sesi Peserta
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pantau progres pengerjaan, pelanggaran tab, dan lakukan reset sesi apabila perangkat
            siswa terkendala.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 accent-blue-600"
            />
            Auto-Refresh 3s
          </label>
          <button
            type="button"
            onClick={() => void fetchMonitoring(selectedExamId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Exam Filter */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          Pantau Paket Ujian:
        </label>
        <select
          value={selectedExamId}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedExamId(id);
            void fetchMonitoring(id);
          }}
          className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
        >
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.subject_name} — {ex.title} ({ex.status})
            </option>
          ))}
        </select>
      </div>

      {/* Summary 4-Card Row */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Terdaftar</span>
              <Users className="h-4 w-4" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {data.summary.total_registered}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
              <span>Sedang Mengerjakan</span>
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {data.summary.in_progress}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <span>Selesai Ujian</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {data.summary.completed}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
              <span>Terindikasi Pelanggaran</span>
              <ShieldAlert className="h-4 w-4" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {data.summary.flagged_cheating}
            </p>
          </div>
        </div>
      )}

      {/* Monitoring Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading || !data ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3 font-semibold">No. Peserta</th>
                  <th className="px-5 py-3 font-semibold">Nama Peserta</th>
                  <th className="px-5 py-3 font-semibold">Kelas</th>
                  <th className="px-5 py-3 font-semibold">Status Sesi</th>
                  <th className="px-5 py-3 font-semibold text-right">Progres</th>
                  <th className="px-5 py-3 font-semibold text-right">Pelanggaran Tab</th>
                  <th className="px-5 py-3 font-semibold text-right">Skor</th>
                  <th className="px-5 py-3 font-semibold text-right">Kontrol Proktor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.rows.map((row) => (
                  <tr
                    key={row.participant_id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-mono font-semibold">{row.exam_number}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {row.full_name}
                    </td>
                    <td className="px-5 py-3">{row.class_name}</td>
                    <td className="px-5 py-3 font-semibold">
                      {row.status === 'flagged_cheating' ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          Dicurigai Curang (Terkunci)
                        </span>
                      ) : row.status === 'completed' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Selesai</span>
                      ) : row.status === 'in_progress' ? (
                        <span className="text-blue-600 dark:text-blue-400">
                          Sedang Mengerjakan
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum Login</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {row.session_id ? `${row.answered_count}/${row.total_questions}` : '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">
                      {row.violations_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setLogModalEntry(row)}
                          className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {row.violations_count}x
                        </button>
                      ) : (
                        <span className="text-slate-400">0x</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold tabular-nums">
                      {row.final_score !== null ? row.final_score.toFixed(1) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {row.session_id ? (
                        <div className="inline-flex items-center gap-1.5">
                          {row.status === 'in_progress' && (
                            <button
                              type="button"
                              disabled={actionBusyId === row.session_id}
                              onClick={() => handleForceFinish(row.session_id!)}
                              className="rounded-md border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            >
                              Selesaikan
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionBusyId === row.session_id}
                            onClick={() => handleResetSession(row.session_id!)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset Sesi
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Violation Logs Modal */}
      {logModalEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold">
                  Riwayat Pelanggaran — {logModalEntry.full_name}
                </h3>
                <p className="text-xs font-mono text-slate-500">{logModalEntry.exam_number}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogModalEntry(null)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto">
              {logModalEntry.violation_logs.map((log, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/40 p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                    <span>Pelanggaran #{i + 1}</span>
                    <span className="font-mono">{log.duration_seconds} detik</span>
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-200">{log.reason}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {logModalEntry.session_id && (
                <button
                  type="button"
                  onClick={() => {
                    const sid = logModalEntry.session_id!;
                    setLogModalEntry(null);
                    void handleResetSession(sid);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset & Izinkan Ujian Ulang
                </button>
              )}
              <button
                type="button"
                onClick={() => setLogModalEntry(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
