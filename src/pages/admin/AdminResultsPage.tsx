import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { exportResultsToExcel, exportResultsToPdf } from '../../lib/export-utils';
import type { AdminResultRow, Exam, InstitutionSettings } from '../../types/cbt';

export const AdminResultsPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [institution, setInstitution] = useState<InstitutionSettings | null>(null);
  const [results, setResults] = useState<AdminResultRow[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async (examFilter: string, classFilter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (examFilter !== 'ALL') params.set('exam_id', examFilter);
      if (classFilter !== 'ALL') params.set('class_name', classFilter);
      const res = await apiFetch<{ results: AdminResultRow[] }>(
        `/api/admin/results?${params.toString()}`,
        { admin: true }
      );
      setResults(res.results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<{ exams: Exam[] }>('/api/admin/exams', { admin: true }),
      apiFetch<{ settings: InstitutionSettings }>('/api/admin/settings', { admin: true }),
    ]).then(([exRes, setRes]) => {
      setExams(exRes.exams);
      setInstitution(setRes.settings);
    });
    void loadResults('ALL', 'ALL');
  }, [loadResults]);

  const classOptions = useMemo(() => {
    const s = new Set(results.map((r) => r.class_name));
    return ['ALL', ...Array.from(s).sort()];
  }, [results]);

  const stats = useMemo(() => {
    if (results.length === 0) {
      return { avg: 0, passed: 0, passRate: 0, highest: 0 };
    }
    const sum = results.reduce((acc, r) => acc + r.final_score, 0);
    const passed = results.filter((r) => r.passing_status === 'LULUS').length;
    const highest = Math.max(...results.map((r) => r.final_score));
    return {
      avg: sum / results.length,
      passed,
      passRate: (passed / results.length) * 100,
      highest,
    };
  }, [results]);

  const activeExamLabel =
    selectedExamId === 'ALL'
      ? 'Semua Paket Ujian'
      : exams.find((e) => String(e.id) === selectedExamId)?.title || 'Paket Ujian';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Rekapitulasi & Ekspor Nilai
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Matriks nilai resmi peserta ujian dengan ekspor langsung ke format Excel (.xlsx) dan
            PDF siap cetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={results.length === 0}
            onClick={() =>
              exportResultsToExcel(
                results,
                `Rekap_Nilai_${activeExamLabel.replace(/\s+/g, '_')}.xlsx`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-40 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Ekspor Excel (.xlsx)
          </button>
          <button
            type="button"
            disabled={results.length === 0}
            onClick={() => exportResultsToPdf(results, institution, activeExamLabel)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            Cetak Laporan PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Filter Paket Ujian
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedExamId(val);
              void loadResults(val, selectedClass);
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
          >
            <option value="ALL">Semua Paket Ujian</option>
            {exams.map((ex) => (
              <option key={ex.id} value={String(ex.id)}>
                {ex.subject_name} — {ex.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Filter Kelas / Rombel
          </label>
          <select
            value={selectedClass}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedClass(val);
              void loadResults(selectedExamId, val);
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
          >
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'Semua Kelas' : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Jumlah Nilai Masuk</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{results.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Rata-Rata Skor</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
            {stats.avg.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Persentase Tuntas KKM</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.passRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Nilai Tertinggi</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {stats.highest.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            <Download className="mx-auto h-7 w-7 text-slate-300 mb-2" />
            Belum ada hasil ujian yang tersimpan untuk filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">No. Peserta</th>
                  <th className="px-4 py-3 font-semibold">Nama Lengkap</th>
                  <th className="px-4 py-3 font-semibold">Kelas</th>
                  <th className="px-4 py-3 font-semibold">Mata Pelajaran</th>
                  <th className="px-4 py-3 font-semibold text-right">Benar</th>
                  <th className="px-4 py-3 font-semibold text-right">Salah</th>
                  <th className="px-4 py-3 font-semibold text-right">Kosong</th>
                  <th className="px-4 py-3 font-semibold text-right">Skor Akhir</th>
                  <th className="px-4 py-3 font-semibold">Kelulusan</th>
                  <th className="px-4 py-3 font-semibold">Integritas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {results.map((r) => (
                  <tr key={r.result_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold">{r.exam_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {r.full_name}
                    </td>
                    <td className="px-4 py-3">{r.class_name}</td>
                    <td className="px-4 py-3">{r.subject_name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600">
                      {r.total_correct}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-600">
                      {r.total_wrong}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">
                      {r.total_empty}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                      {r.final_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {r.passing_status === 'LULUS' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">LULUS</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">BELUM LULUS</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.session_status === 'flagged_cheating' ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          Curang ({r.violations_count}x)
                        </span>
                      ) : (
                        <span className="text-slate-500">Normal ({r.violations_count}x)</span>
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
