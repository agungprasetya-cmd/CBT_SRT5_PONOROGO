import { AlertOctagon, Maximize, ShieldAlert } from 'lucide-react';
import React from 'react';
import type { WarningModalState } from '../../hooks/useAntiCheat';

interface AntiCheatGuardProps {
  isFullscreen: boolean;
  hasEnteredFullscreenOnce: boolean;
  onEnterFullscreen: () => void;
  warningModal: WarningModalState;
  onDismissWarning: () => void;
  shortcutNotice: string | null;
  children: React.ReactNode;
}

export const AntiCheatGuard: React.FC<AntiCheatGuardProps> = ({
  isFullscreen,
  hasEnteredFullscreenOnce,
  onEnterFullscreen,
  warningModal,
  onDismissWarning,
  shortcutNotice,
  children,
}) => {
  const showFullscreenGate = !isFullscreen;

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      {/* Main Exam Content (blurred when fullscreen is exited) */}
      <div
        className={`h-full w-full transition-[filter] duration-150 ${
          showFullscreenGate ? 'blur-md pointer-events-none' : ''
        }`}
      >
        {children}
      </div>

      {/* Shortcut / Input Lockout Toast */}
      {shortcutNotice && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose-300 bg-rose-950 px-4 py-2.5 text-xs font-medium text-rose-100 shadow-xl flex items-center gap-2"
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{shortcutNotice}</span>
        </div>
      )}

      {/* Fullscreen Enforcement Gate / Blur Overlay */}
      {showFullscreenGate && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Kunci Mode Layar Penuh CBT"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Maximize className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
              {hasEnteredFullscreenOnce
                ? 'Mode Layar Penuh Terputus'
                : 'Aktifkan Mode Layar Penuh'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {hasEnteredFullscreenOnce
                ? 'Sistem mendeteksi Anda keluar dari mode layar penuh. Demi keamanan ujian, lembar soal diburamkan sampai Anda kembali ke mode layar penuh.'
                : 'Ujian berbasis komputer ini menerapkan protokol keamanan layar penuh. Jangan menekan tombol Esc, berpindah tab, atau membuka aplikasi lain selama mengerjakan soal.'}
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p>Aturan Keamanan Ujian:</p>
              <p>1. Meninggalkan halaman &ge; 5 detik dihitung sebagai pelanggaran.</p>
              <p>2. Batas maksimal 2 kali peringatan. Pelanggaran ke-3 mengakhiri ujian otomatis.</p>
              <p>3. Klik kanan, salin-tempel, dan pintasan sistem dinonaktifkan.</p>
            </div>
            <button
              type="button"
              onClick={onEnterFullscreen}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Maximize className="h-4 w-4" />
              {hasEnteredFullscreenOnce
                ? 'Kembali ke Mode Layar Penuh'
                : 'Masuk Layar Penuh & Mulai Ujian'}
            </button>
          </div>
        </div>
      )}

      {/* Security Warning Modal (Violations 1 & 2) */}
      {warningModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label="Peringatan Keamanan Ujian"
        >
          <div className="w-full max-w-lg rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-7 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="h-7 w-7 shrink-0" />
              <span className="text-base font-bold">
                PERINGATAN KEAMANAN ({warningModal.violationsCount} / 3)
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              PERINGATAN KEAMANAN: Sistem mendeteksi Anda meninggalkan halaman ujian selama{' '}
              <strong className="font-mono">{warningModal.awaySeconds}</strong> detik. Pelanggaran ke-3
              akan mengakhiri ujian Anda secara otomatis.
            </p>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Pemicu terdeteksi: {warningModal.reason}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onDismissWarning();
                  onEnterFullscreen();
                }}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                Saya Mengerti & Kembali ke Ujian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
