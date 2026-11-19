import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Moon,
  ShieldCheck,
  Sun,
  User,
  UserCheck,
  Wifi,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, apiFetch } from '../../lib/api';
import { useExamStore } from '../../store/examStore';
import { useThemeStore } from '../../store/themeStore';
import type { InstitutionSettings, PublicExam } from '../../types/cbt';

interface BootstrapResponse {
  institution: InstitutionSettings;
  exams: PublicExam[];
  server_now: string;
}

export const StudentLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const initExamSession = useExamStore((s) => s.initExamSession);
  const activeSession = useExamStore((s) => s.session);
  const activeExam = useExamStore((s) => s.exam);
  const activeParticipant = useExamStore((s) => s.participant);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [institution, setInstitution] = useState<InstitutionSettings | null>(null);
  const [exams, setExams] = useState<PublicExam[]>([]);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);

  const [examNumber, setExamNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const fullNameSourceRef = useRef<'empty' | 'auto' | 'manual'>('empty');
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [modalError, setModalError] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });

  useEffect(() => {
    let mounted = true;
    apiFetch<BootstrapResponse>('/api/public/bootstrap')
      .then((data) => {
        if (!mounted) return;
        setInstitution(data.institution);
        setExams(data.exams);
        if (data.exams.length > 0) {
          setSelectedExamId(data.exams[0].id);
        }
      })
      .catch(() => {
        // Handled silently on initial load
      })
      .finally(() => {
        if (mounted) setLoadingBootstrap(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = examNumber.trim();
    if (!trimmed) {
      if (fullNameSourceRef.current === 'auto') {
        setFullName('');
        fullNameSourceRef.current = 'empty';
      }
      return;
    }

    if (fullNameSourceRef.current === 'manual') {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiFetch<{ found: boolean; full_name?: string }>(
        `/api/public/participant-lookup?exam_number=${encodeURIComponent(trimmed)}`
      )
        .then((data) => {
          if (cancelled || fullNameSourceRef.current === 'manual') return;
          if (data.found && data.full_name) {
            setFullName(data.full_name);
            fullNameSourceRef.current = 'auto';
          } else if (fullNameSourceRef.current === 'auto') {
            setFullName('');
            fullNameSourceRef.current = 'empty';
          }
        })
        .catch(() => {
          // Ignore lookup error silently; login submission handles validation
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [examNumber]);

  const currentExam = exams.find((e) => e.id === selectedExamId) || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim()) {
      setModalError({
        open: true,
        title: 'Nomor Peserta Kosong',
        message: 'Masukkan Nomor Peserta ujian Anda terlebih dahulu.',
      });
      return;
    }
    if (!fullName.trim()) {
      setModalError({
        open: true,
        title: 'Nama Lengkap Kosong',
        message: 'Masukkan Nama Lengkap Siswa sesuai data peserta ujian.',
      });
      return;
    }
    if (!selectedExamId) {
      setModalError({
        open: true,
        title: 'Pilih Paket Ujian',
        message: 'Tidak ada paket ujian aktif yang dipilih.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = await apiFetch<any>('/api/student/login', {
        method: 'POST',
        body: JSON.stringify({
          exam_number: examNumber.trim(),
          full_name: fullName.trim(),
          exam_id: selectedExamId,
          token: token.trim(),
        }),
      });
      initExamSession(payload);
      navigate('/ujian/ruang');
    } catch (err) {
      if (err instanceof ApiError) {
        setModalError({
          open: true,
          title: err.title || 'Akses Ujian Ditolak',
          message: err.message,
        });
      } else {
        setModalError({
          open: true,
          title: 'Gangguan Koneksi',
          message: 'Tidak dapat terhubung ke server ujian. Periksa jaringan Anda.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Clean 3-Zone Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-3.5">
          <Link
            to="/login"
            className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            {institution?.school_name || 'Sekolah Rakyat Terintegrasi 5 Ponorogo'}
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#tata-tertib" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Tata Tertib
            </a>
            <a href="#akun-uji" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Panduan Peserta
            </a>
            <Link to="/admin/login" className="hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0">
              Portal Proktor
            </Link>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Ubah Tema Layar"
              title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/admin/login"
              className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Login Proktor
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-6 py-10 lg:py-14">
        {/* Resume Banner if unfinished local session exists */}
        {activeSession && activeSession.status === 'in_progress' && activeExam && activeParticipant && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 px-6 py-4">
            <div className="text-sm">
              <p className="font-semibold text-blue-950 dark:text-blue-100">
                Sesi Ujian Aktif Ditemukan di Perangkat Ini
              </p>
              <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                {activeParticipant.full_name} ({activeParticipant.exam_number}) · {activeExam.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/ujian/ruang')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              Lanjutkan Ujian Sekarang
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
          {/* Left Column: Institution Identity & Exam Protocol */}
          <section className="lg:col-span-7 space-y-8">
            <div className="flex items-start gap-5">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white p-1.5">
                <img
                  src={institution?.logo_url || '/src/assets/images/regenerated_image_1794889064827.png'}
                  alt={institution?.school_name || 'Sekolah Rakyat Terintegrasi 5 Ponorogo'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain rounded-lg"
                />
              </div>
              <div>
                <p className="text-base font-bold text-slate-500 dark:text-slate-400">
                  {institution?.exam_event_name || 'Asesmen Berbasis Komputer'} · Tahun Pelajaran{' '}
                  {institution?.academic_year || '2026/2027'}
                </p>
                <h1 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                  Computer Based Test
                </h1>
                <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  Silakan masuk menggunakan Nomor Peserta resmi dan Token Ujian yang dibagikan
                  oleh Proktor ruangan. Jawaban tersimpan otomatis di perangkat dan disinkronkan
                  ke server secara berkala.
                </p>
              </div>
            </div>

            <div
              id="tata-tertib"
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800"
            >
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Kunci Layar Penuh
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Ujian berjalan dalam mode layar penuh. Berpindah tab atau aplikasi &ge; 5 detik
                  tercatat sebagai pelanggaran.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tahan Putus Jaringan
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Setiap klik jawaban langsung tersimpan aman secara lokal dan otomatis
                  terkirim begitu koneksi pulih.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <CheckCircle2 className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Penilaian Server
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Kunci jawaban terisolasi penuh di server. Skor akhir dihitung otomatis dan
                  transparan saat selesai.
                </p>
              </div>
            </div>

            {/* Quick Demo Reference for Evaluators / School Operators */}
            <div
              id="akun-uji"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Referensi Uji Coba Cepat Peserta & Proktor
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Klik nomor peserta untuk mengisi otomatis
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    fullNameSourceRef.current = 'auto';
                    setExamNumber('2026-SMAIPA-001');
                    setFullName('Agung Prasetya');
                    if (exams[0]) {
                      setSelectedExamId(exams[0].id);
                      setToken(exams[0].subject_name.includes('Matematika') ? 'MTKIPA2026' : 'FIS2026');
                    }
                  }}
                  className="text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 hover:border-blue-400 transition-colors"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Agung Prasetya (SMA IPA)
                  </div>
                  <div className="mt-1 font-mono text-slate-600 dark:text-slate-300">
                    No: 2026-SMAIPA-001 · Token: MTKIPA2026
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fullNameSourceRef.current = 'auto';
                    setExamNumber('2026-SMPA-002');
                    setFullName('Prasetya Agung');
                    if (exams[1]) {
                      setSelectedExamId(exams[1].id);
                      setToken('BIND2026');
                    }
                  }}
                  className="text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 hover:border-blue-400 transition-colors"
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Prasetya Agung (SMP A)
                  </div>
                  <div className="mt-1 font-mono text-slate-600 dark:text-slate-300">
                    No: 2026-SMPA-002 · Token: BIND2026
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* Right Column: Login Card */}
          <section className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Masuk Ruang Ujian
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Verifikasi identitas peserta dan pilih jadwal ujian aktif.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="exam_number"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nomor Peserta Ujian
                  </label>
                  <div className="relative">
                    <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="exam_number"
                      type="text"
                      value={examNumber}
                      onChange={(e) => setExamNumber(e.target.value)}
                      placeholder="Contoh: 2026-SMAIPA-001"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="full_name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nama Lengkap Siswa
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="full_name"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFullName(val);
                        fullNameSourceRef.current = val.trim() ? 'manual' : 'empty';
                      }}
                      placeholder="Contoh: Agung Prasetya"
                      autoComplete="name"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="exam_id"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Mata Pelajaran / Sesi Ujian Aktif
                  </label>
                  {loadingBootstrap ? (
                    <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  ) : exams.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                      Belum ada sesi ujian yang berstatus Aktif saat ini.
                    </div>
                  ) : (
                    <select
                      id="exam_id"
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.subject_name} — {ex.title} ({ex.duration_minutes} menit)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {currentExam && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Durasi: <strong className="font-mono">{currentExam.duration_minutes} menit</strong>
                    </span>
                    <span>
                      Jumlah Soal: <strong className="font-mono">{currentExam.question_count}</strong>
                    </span>
                    <span>
                      KKM: <strong className="font-mono">{currentExam.kkm}</strong>
                    </span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="exam_token"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Token Ujian {currentExam?.requires_token ? '(Wajib)' : '(Opsional)'}
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="exam_token"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      placeholder="Masukkan Token (misal: MTK2026)"
                      autoComplete="off"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 font-mono text-sm uppercase text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || exams.length === 0}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Memverifikasi Data Peserta...' : 'Mulai / Masuk Ujian'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>

      {/* Error Alert Modal */}
      {modalError.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold">{modalError.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {modalError.message}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setModalError({ open: false, title: '', message: '' })}
                className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
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
