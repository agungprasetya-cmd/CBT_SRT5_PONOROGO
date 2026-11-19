import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useExamStore } from '../store/examStore';
import type { ExamResult } from '../types/cbt';

export interface WarningModalState {
  open: boolean;
  violationsCount: number;
  awaySeconds: number;
  reason: string;
}

interface UseAntiCheatOptions {
  enabled: boolean;
  onForcedSubmit: (result: ExamResult | null) => void;
}

export function useAntiCheat({ enabled, onForcedSubmit }: UseAntiCheatOptions) {
  const session = useExamStore((s) => s.session);
  const violationsCount = useExamStore((s) => s.violationsCount);
  const setViolationsCount = useExamStore((s) => s.setViolationsCount);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const [hasEnteredFullscreenOnce, setHasEnteredFullscreenOnce] = useState(false);
  const [warningModal, setWarningModal] = useState<WarningModalState>({
    open: false,
    violationsCount: 0,
    awaySeconds: 0,
    reason: '',
  });
  const [shortcutNotice, setShortcutNotice] = useState<string | null>(null);

  const awayStartRef = useRef<number | null>(null);
  const awayTimerRef = useRef<number | null>(null);
  const loggedCurrentAwayRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);
  const isSubmittingViolationRef = useRef(false);

  const showShortcutBlock = useCallback((message: string) => {
    setShortcutNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setShortcutNotice(null);
    }, 3200);
  }, []);

  const reportViolation = useCallback(
    async (reason: string, durationSeconds: number) => {
      const state = useExamStore.getState();
      if (!state.session || isSubmittingViolationRef.current) return;
      isSubmittingViolationRef.current = true;

      try {
        const answersList = Object.values(state.answers);
        const res = await apiFetch<{
          violations_count: number;
          max_violations: number;
          forced_submit: boolean;
          result?: ExamResult;
        }>('/api/student/violation', {
          method: 'POST',
          body: JSON.stringify({
            session_id: state.session.id,
            reason,
            duration_seconds: Math.max(1, Math.round(durationSeconds)),
            answers: answersList,
          }),
        });

        setViolationsCount(res.violations_count);

        if (res.forced_submit) {
          onForcedSubmit(res.result ?? null);
        } else {
          setWarningModal({
            open: true,
            violationsCount: res.violations_count,
            awaySeconds: Math.max(5, Math.round(durationSeconds)),
            reason,
          });
        }
      } catch {
        // Fallback local increment if temporarily offline during violation
        const nextCount = state.violationsCount + 1;
        setViolationsCount(nextCount);
        setWarningModal({
          open: true,
          violationsCount: nextCount,
          awaySeconds: Math.max(5, Math.round(durationSeconds)),
          reason,
        });
      } finally {
        isSubmittingViolationRef.current = false;
      }
    },
    [onForcedSubmit, setViolationsCount]
  );

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
      setHasEnteredFullscreenOnce(true);
    } catch {
      // Fallback if iframe or browser blocks native fullscreen API
      setIsFullscreen(true);
      setHasEnteredFullscreenOnce(true);
    }
  }, []);

  // Monitor Fullscreen changes
  useEffect(() => {
    if (!enabled) return;
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        setHasEnteredFullscreenOnce(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [enabled]);

  // Monitor Tab Switch & Window Blur (>= 5 seconds rule)
  useEffect(() => {
    if (!enabled || !session) return;

    const startAwayTracking = (reason: string) => {
      if (awayStartRef.current !== null) return;
      awayStartRef.current = Date.now();
      loggedCurrentAwayRef.current = false;

      if (awayTimerRef.current) window.clearTimeout(awayTimerRef.current);
      awayTimerRef.current = window.setTimeout(() => {
        if (awayStartRef.current !== null && !loggedCurrentAwayRef.current) {
          loggedCurrentAwayRef.current = true;
          const elapsed = (Date.now() - awayStartRef.current) / 1000;
          void reportViolation(reason, elapsed);
        }
      }, 5000);
    };

    const stopAwayTracking = (reason: string) => {
      if (awayTimerRef.current) {
        window.clearTimeout(awayTimerRef.current);
        awayTimerRef.current = null;
      }
      if (awayStartRef.current !== null) {
        const elapsed = (Date.now() - awayStartRef.current) / 1000;
        awayStartRef.current = null;
        if (elapsed >= 5 && !loggedCurrentAwayRef.current) {
          loggedCurrentAwayRef.current = true;
          void reportViolation(reason, elapsed);
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        startAwayTracking('Berpindah tab atau menyembunyikan jendela ujian');
      } else {
        stopAwayTracking('Berpindah tab atau menyembunyikan jendela ujian');
      }
    };

    const onWindowBlur = () => {
      startAwayTracking('Meninggalkan jendela ujian (Window Blur)');
    };

    const onWindowFocus = () => {
      stopAwayTracking('Meninggalkan jendela ujian (Window Blur)');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      if (awayTimerRef.current) window.clearTimeout(awayTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [enabled, session, reportViolation]);

  // Browser & Input Lockout (Context Menu, Copy/Paste/Cut, DevTools, PrintScreen)
  useEffect(() => {
    if (!enabled) return;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showShortcutBlock('Klik kanan dinonaktifkan selama ujian berlangsung.');
    };

    const onClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      showShortcutBlock('Fitur salin dan tempel dinonaktifkan oleh sistem keamanan CBT.');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') {
        e.preventDefault();
        showShortcutBlock('Akses DevTools (F12) diblokir selama ujian.');
        return;
      }

      if (e.key === 'PrintScreen') {
        e.preventDefault();
        showShortcutBlock('Tangkapan layar (PrintScreen) dilarang selama ujian.');
        return;
      }

      if (ctrlOrMeta && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault();
        showShortcutBlock('Pintasan inspeksi elemen diblokir selama ujian.');
        return;
      }

      if (ctrlOrMeta && ['c', 'v', 'x', 'u', 's', 'p'].includes(key)) {
        e.preventDefault();
        showShortcutBlock(`Pintasan Ctrl+${key.toUpperCase()} diblokir selama ujian.`);
      }
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onClipboard);
    document.addEventListener('cut', onClipboard);
    document.addEventListener('paste', onClipboard);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onClipboard);
      document.removeEventListener('cut', onClipboard);
      document.removeEventListener('paste', onClipboard);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [enabled, showShortcutBlock]);

  const dismissWarningModal = useCallback(() => {
    setWarningModal((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    isFullscreen,
    hasEnteredFullscreenOnce,
    requestFullscreen,
    violationsCount,
    warningModal,
    dismissWarningModal,
    shortcutNotice,
  };
}
