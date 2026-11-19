import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flag,
  Grid,
  Moon,
  Send,
  ShieldAlert,
  Sun,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AntiCheatGuard } from '../../components/cbt/AntiCheatGuard';
import { CountdownTimer } from '../../components/cbt/CountdownTimer';
import { ImageZoomModal } from '../../components/cbt/ImageZoomModal';
import { MathRenderer } from '../../components/cbt/MathRenderer';
import { QuestionNavigator } from '../../components/cbt/QuestionNavigator';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useExamSync } from '../../hooks/useExamSync';
import { apiFetch } from '../../lib/api';
import { useExamStore } from '../../store/examStore';
import { useThemeStore } from '../../store/themeStore';
import type { OptionKey } from '../../types/cbt';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

export const ExamRoomPage: React.FC = () => {
  const navigate = useNavigate();

  const institution = useExamStore((s) => s.institution);
  const participant = useExamStore((s) => s.participant);
  const exam = useExamStore((s) => s.exam);
  const session = useExamStore((s) => s.session);
  const questions = useExamStore((s) => s.questions);
  const answers = useExamStore((s) => s.answers);
  const currentIndex = useExamStore((s) => s.currentIndex);
  const fontScale = useExamStore((s) => s.fontScale);
  const serverOffsetMs = useExamStore((s) => s.serverOffsetMs);
  const dirtyQuestionIds = useExamStore((s) => s.dirtyQuestionIds);

  const setAnswer = useExamStore((s) => s.setAnswer);
  const toggleDoubtful = useExamStore((s) => s.toggleDoubtful);
  const setCurrentIndex = useExamStore((s) => s.setCurrentIndex);
  const setFontScale = useExamStore((s) => s.setFontScale);
  const clearExamSession = useExamStore((s) => s.clearExamSession);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remoteLockNotice, setRemoteLockNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !exam || !participant || questions.length === 0) {
      navigate('/login', { replace: true });
    }
  }, [session, exam, participant, questions.length, navigate]);

  const { syncStatus, flushSyncNow } = useExamSync({
    onRemoteLocked: (reason) => {
      setRemoteLockNotice(reason);
    },
  });

  const handleForcedSubmit = useCallback(() => {
    if (!session) return;
    const finishedSessionId = session.id;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    clearExamSession();
    navigate(`/ujian/selesai?session_id=${finishedSessionId}`, { replace: true });
  }, [session, clearExamSession, navigate]);

  const {
    isFullscreen,
    hasEnteredFullscreenOnce,
    requestFullscreen,
    violationsCount,
    warningModal,
    dismissWarningModal,
    shortcutNotice,
  } = useAntiCheat({
    enabled: Boolean(session),
    onForcedSubmit: handleForcedSubmit,
  });

  const finalizeSubmit = useCallback(async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const answersList = Object.values(useExamStore.getState().answers);
      await apiFetch('/api/student/submit', {
        method: 'POST',
        body: JSON.stringify({
          session_id: session.id,
          answers: answersList,
        }),
      });
      const finishedId = session.id;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      clearExamSession();
      navigate(`/ujian/selesai?session_id=${finishedId}`, { replace: true });
    } catch {
      setSubmitting(false);
      setConfirmSubmitOpen(false);
    }
  }, [session, submitting, clearExamSession, navigate]);

  const summary = useMemo(() => {
    let answered = 0;
    let doubtful = 0;
    let empty = 0;
    for (const q of questions) {
      const a = answers[q.id];
      if (a?.is_doubtful) doubtful += 1;
      if (a?.selected_option) answered += 1;
      else empty += 1;
    }
    return { answered, doubtful, empty, total: questions.length };
  }, [questions, answers]);

  if (!session || !exam || !participant || questions.length === 0) {
    return null;
  }

  const activeQuestion = questions[currentIndex];
  const currentAnswer = answers[activeQuestion.id];

  const handleNavigate = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setMobileNavOpen(false);
    void flushSyncNow();
  };

  const fontClass =
    fontScale === 'sm'
      ? 'text-sm'
      : fontScale === 'lg'
        ? 'text-lg'
        : 'text-base';

  const getOptionText = (key: OptionKey): string => {
    switch (key) {
      case 'A':
        return activeQuestion.option_a;
      case 'B':
        return activeQuestion.option_b;
      case 'C':
        return activeQuestion.option_c;
      case 'D':
        return activeQuestion.option_d;
      case 'E':
        return activeQuestion.option_e;
    }
  };

  const getOptionImage = (key: OptionKey): string | null => {
    switch (key) {
      case 'A':
        return activeQuestion.option_a_image;
      case 'B':
        return activeQuestion.option_b_image;
      case 'C':
        return activeQuestion.option_c_image;
      case 'D':
        return activeQuestion.option_d_image;
      case 'E':
        return activeQuestion.option_e_image;
    }
  };

  return (
    <AntiCheatGuard
      isFullscreen={isFullscreen}
      hasEnteredFullscreenOnce={hasEnteredFullscreenOnce}
      onEnterFullscreen={requestFullscreen}
      warningModal={warningModal}
      onDismissWarning={dismissWarningModal}
      shortcutNotice={shortcutNotice}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Top Header Bar */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {institution?.logo_url && (
              <img
                src={institution.logo_url}
                alt={institution.school_name}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white object-contain p-0.5 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {exam.subject_name} · {institution?.school_name}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                {participant.full_name} (<span className="font-mono">{participant.exam_number}</span>) ·{' '}
                {participant.class_name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real Connection Sync Status */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                syncStatus === 'offline'
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : syncStatus === 'syncing'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {syncStatus === 'offline' ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Koneksi Terputus - Tersimpan Lokal ({dirtyQuestionIds.length})
                  </span>
                </>
              ) : syncStatus === 'syncing' ? (
                <>
                  <Wifi className="h-3.5 w-3.5 shrink-0" />
                  <span>Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 shrink-0" />
                  <span>Terhubung ke Server</span>
                </>
              )}
            </div>

            {violationsCount > 0 && (
              <div className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-mono tabular-nums">
                <ShieldAlert className="h-3.5 w-3.5" />
                Pelanggaran: {violationsCount}/3
              </div>
            )}

            <CountdownTimer
              endTimeIso={session.end_time}
              serverOffsetMs={serverOffsetMs}
              onExpire={finalizeSubmit}
            />

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Ubah Tema Layar"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Akhiri Ujian
            </button>
          </div>
        </header>

        {/* Main Split Area: 70% Question Workspace + 30% Matrix Sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left/Center 70%: Question Workspace */}
          <main className="flex flex-1 lg:w-[70%] flex-col overflow-hidden">
            {/* Sub-toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  Soal No. {currentIndex + 1} / {questions.length}
                </span>
                {currentAnswer?.is_doubtful && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <Flag className="h-3 w-3" />
                    Ditandai Ragu-ragu
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFontScale('sm')}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      fontScale === 'sm'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontScale('md')}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      fontScale === 'md'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontScale('lg')}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      fontScale === 'lg'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    A+
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold"
                >
                  <Grid className="h-4 w-4" />
                  Daftar Soal
                </button>
              </div>
            </div>

            {/* Scrollable Question & Options Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8">
              <div className="mx-auto max-w-3xl space-y-6">
                {/* Question Stimulus */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                  <MathRenderer
                    content={activeQuestion.question_text}
                    className={`${fontClass} text-slate-900 dark:text-slate-100`}
                  />

                  {activeQuestion.image_url && (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => setZoomedImage(activeQuestion.image_url)}
                        className="group relative inline-flex flex-col items-start overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2 hover:border-blue-500 transition-colors"
                      >
                        <img
                          src={activeQuestion.image_url}
                          alt={`Stimulus gambar soal nomor ${currentIndex + 1}`}
                          referrerPolicy="no-referrer"
                          className="max-h-72 rounded object-contain"
                        />
                        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                          <ZoomIn className="h-3.5 w-3.5" />
                          Klik gambar untuk memperbesar
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Options A - E */}
                <div className="space-y-3" role="radiogroup" aria-label="Pilihan Jawaban">
                  {OPTION_KEYS.map((key) => {
                    const text = getOptionText(key);
                    const optImg = getOptionImage(key);
                    const isSelected = currentAnswer?.selected_option === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setAnswer(activeQuestion.id, key)}
                        className={`w-full text-left flex items-start gap-4 rounded-xl border p-4 transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/50 ring-2 ring-blue-600/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-bold transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {key}
                        </span>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <MathRenderer
                            content={text}
                            className={`${fontClass} text-slate-900 dark:text-slate-100`}
                          />
                          {optImg && (
                            <img
                              src={optImg}
                              alt={`Gambar opsi ${key}`}
                              referrerPolicy="no-referrer"
                              className="mt-2 max-h-36 rounded border border-slate-200 dark:border-slate-700 bg-white p-1 object-contain"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Navigation Bar */}
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => handleNavigate(currentIndex - 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
              >
                <ArrowLeft className="h-4 w-4" />
                Sebelumnya
              </button>

              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 select-none">
                <input
                  type="checkbox"
                  checked={Boolean(currentAnswer?.is_doubtful)}
                  onChange={() => toggleDoubtful(activeQuestion.id)}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
                Ragu-ragu
              </label>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => handleNavigate(currentIndex + 1)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Selanjutnya
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSubmitOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Selesai & Kirim
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
            </footer>
          </main>

          {/* Right 30% Desktop Sidebar: Question Matrix */}
          <aside className="hidden lg:block w-[30%] max-w-sm border-l border-slate-200 dark:border-slate-800">
            <QuestionNavigator
              questions={questions}
              answers={answers}
              currentIndex={currentIndex}
              onSelectIndex={handleNavigate}
            />
          </aside>
        </div>
      </div>

      {/* Mobile Drawer Navigator */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 lg:hidden">
          <div className="relative h-full w-80 max-w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <span className="text-sm font-bold">Pilih Nomor Soal</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <QuestionNavigator
                questions={questions}
                answers={answers}
                currentIndex={currentIndex}
                onSelectIndex={handleNavigate}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Lightbox */}
      <ImageZoomModal
        src={zoomedImage}
        alt={`Gambar Soal Nomor ${currentIndex + 1}`}
        onClose={() => setZoomedImage(null)}
      />

      {/* Confirm Final Submit Modal */}
      {confirmSubmitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Konfirmasi Akhiri Ujian
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Pastikan seluruh jawaban telah diperiksa sebelum dikirim permanen ke server.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {summary.answered}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-400">
                  Dijawab
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                <div className="font-mono text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  {summary.doubtful}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-400">
                  Ragu-ragu
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3">
                <div className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {summary.empty}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Kosong
                </div>
              </div>
            </div>

            {(summary.empty > 0 || summary.doubtful > 0) && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Masih terdapat {summary.empty} soal belum dijawab dan {summary.doubtful} soal
                  ditandai ragu-ragu.
                </span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmSubmitOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={finalizeSubmit}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Mengirim Jawaban...' : 'Ya, Akhiri & Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote Reset / Lock Modal */}
      {remoteLockNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Status Sesi Diperbarui Proktor
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{remoteLockNotice}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  clearExamSession();
                  navigate('/login', { replace: true });
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          </div>
        </div>
      )}
    </AntiCheatGuard>
  );
};
