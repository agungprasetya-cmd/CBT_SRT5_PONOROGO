import {
  AlertTriangle,
  Award,
  CheckCircle2,
  LogOut,
  Printer,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { exportStudentProofPdf } from '../../lib/export-utils';
import type { StudentResultResponse } from '../../types/cbt';

export const ExamResultPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');

  const [data, setData] = useState<StudentResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('ID sesi ujian tidak ditemukan.');
      setLoading(false);
      return;
    }

    apiFetch<StudentResultResponse>(`/api/student/result/${sessionId}`)
      .then((res) => setData(res))
      .catch((err: any) => setError(err?.message || 'Gagal memuat hasil ujian.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-xl space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-24 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-12 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            Hasil Ujian Tidak Tersedia
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {error || 'Data sesi tidak ditemukan.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-900"
          >
            Kembali ke Halaman Login
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = data.session_status === 'flagged_cheating';
  const isPassed = data.result.passing_status === 'LULUS';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          {/* Header Kop */}
          <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-5 flex items-center gap-4">
            {data.institution.logo_url && (
              <img
                src={data.institution.logo_url}
                alt={data.institution.school_name}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white object-contain p-1"
              />
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {data.institution.school_name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.institution.exam_event_name} · {data.institution.academic_year}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {isFlagged && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-4 text-sm text-rose-800 dark:text-rose-200">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-bold">Dicurigai Curang (Pelanggaran Batas)</p>
                  <p className="mt-1 text-xs">
                    Sesi ujian Anda diakhiri secara otomatis oleh sistem karena melebihi batas
                    maksimal 3 kali pelanggaran keamanan ({data.violations_count}x tercatat).
                  </p>
                </div>
              </div>
            )}

            {/* Identity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-b border-slate-200 dark:border-slate-800 pb-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nama Peserta</p>
                <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                  {data.participant.full_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nomor Peserta</p>
                <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white">
                  {data.participant.exam_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Kelas / Rombel</p>
                <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                  {data.participant.class_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mata Pelajaran</p>
                <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                  {data.exam.subject_name} — {data.exam.title}
                </p>
              </div>
            </div>

            {/* Score Summary */}
            {data.show_result_to_student ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-6">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Skor Akhir Ujian (KKM {data.exam.kkm})
                    </p>
                    <p className="mt-1 font-mono text-4xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {data.result.final_score.toFixed(2)}
                    </p>
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold ${
                      isPassed
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {isPassed ? (
                      <Award className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    <span>{data.result.passing_status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <p className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {data.result.total_correct}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jawaban Benar</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <p className="font-mono text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {data.result.total_wrong}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Jawaban Salah</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <p className="font-mono text-2xl font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                      {data.result.total_empty}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tidak Dijawab</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-5 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-900 dark:text-emerald-100">
                  <p className="font-semibold">Lembar Jawaban Berhasil Dikirim</p>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                    Nilai ujian akan diumumkan secara resmi oleh Proktor / Guru Mata Pelajaran.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => exportStudentProofPdf(data)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" />
                Cetak Bukti Selesai Ujian (PDF)
              </button>

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
              >
                <LogOut className="h-4 w-4" />
                Keluar & Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
