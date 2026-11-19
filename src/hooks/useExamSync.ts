import { useCallback, useEffect, useRef } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import { useExamStore } from '../store/examStore';

interface UseExamSyncOptions {
  onRemoteLocked?: (reason: string) => void;
}

export function useExamSync(options: UseExamSyncOptions = {}) {
  const session = useExamStore((s) => s.session);
  const answers = useExamStore((s) => s.answers);
  const dirtyQuestionIds = useExamStore((s) => s.dirtyQuestionIds);
  const syncStatus = useExamStore((s) => s.syncStatus);
  const setSyncStatus = useExamStore((s) => s.setSyncStatus);
  const markSynced = useExamStore((s) => s.markSynced);

  const isSyncingRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const flushSyncNow = useCallback(async () => {
    const state = useExamStore.getState();
    if (!state.session) return true;
    if (isSyncingRef.current) return false;

    const idsToSync =
      state.dirtyQuestionIds.length > 0
        ? state.dirtyQuestionIds
        : Object.keys(state.answers).map(Number);

    if (idsToSync.length === 0) {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      return true;
    }

    if (!navigator.onLine) {
      setSyncStatus('offline');
      return false;
    }

    const payloadAnswers = idsToSync
      .map((id) => state.answers[id])
      .filter(Boolean);

    if (payloadAnswers.length === 0) return true;

    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiFetch<{ ok: boolean; synced_at: string }>('/api/student/sync', {
        method: 'POST',
        body: JSON.stringify({
          session_id: state.session.id,
          answers: payloadAnswers,
        }),
      });
      markSynced(idsToSync, res.synced_at);
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'SESSION_RESET' || err.code === 'SESSION_LOCKED')) {
        options.onRemoteLocked?.(err.message);
        return false;
      }
      setSyncStatus('offline');
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [markSynced, options, setSyncStatus]);

  // Debounced background sync every 2000ms whenever dirty answers change
  useEffect(() => {
    if (!session || dirtyQuestionIds.length === 0) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void flushSyncNow();
    }, 2000);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [dirtyQuestionIds, session, flushSyncNow]);

  // Auto-recover when browser regains network connectivity
  useEffect(() => {
    const handleOnline = () => {
      void flushSyncNow();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushSyncNow, setSyncStatus]);

  return {
    syncStatus,
    pendingCount: dirtyQuestionIds.length,
    flushSyncNow,
    answersCount: Object.keys(answers).length,
  };
}
