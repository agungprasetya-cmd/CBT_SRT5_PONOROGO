import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ExamSession,
  InstitutionSettings,
  OptionKey,
  Participant,
  StudentAnswerPayload,
  StudentQuestion,
} from '../types/cbt';

export type SyncStatus = 'synced' | 'syncing' | 'offline';
export type FontScale = 'sm' | 'md' | 'lg';

interface ActiveExamMeta {
  id: number;
  title: string;
  subject_name: string;
  duration_minutes: number;
  kkm: number;
  randomize_questions: boolean;
  show_result_to_student: boolean;
}

interface ExamStoreState {
  institution: InstitutionSettings | null;
  participant: Participant | null;
  exam: ActiveExamMeta | null;
  session: ExamSession | null;
  questions: StudentQuestion[];
  answers: Record<number, StudentAnswerPayload>;
  dirtyQuestionIds: number[];
  currentIndex: number;
  fontScale: FontScale;
  serverOffsetMs: number;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  violationsCount: number;

  initExamSession: (payload: {
    server_now: string;
    institution: InstitutionSettings;
    participant: Participant;
    exam: ActiveExamMeta;
    session: ExamSession;
    questions: StudentQuestion[];
    answers: StudentAnswerPayload[];
  }) => void;
  setAnswer: (questionId: number, option: OptionKey) => void;
  toggleDoubtful: (questionId: number) => void;
  setCurrentIndex: (index: number) => void;
  setFontScale: (scale: FontScale) => void;
  setSyncStatus: (status: SyncStatus) => void;
  markSynced: (syncedIds: number[], syncedAt: string) => void;
  setViolationsCount: (count: number) => void;
  clearExamSession: () => void;
}

export const useExamStore = create<ExamStoreState>()(
  persist(
    (set, get) => ({
      institution: null,
      participant: null,
      exam: null,
      session: null,
      questions: [],
      answers: {},
      dirtyQuestionIds: [],
      currentIndex: 0,
      fontScale: 'md',
      serverOffsetMs: 0,
      syncStatus: 'synced',
      lastSyncedAt: null,
      violationsCount: 0,

      initExamSession: (payload) => {
        const currentSessionId = get().session?.id;
        const isSameSession = currentSessionId === payload.session.id;

        const mergedAnswers: Record<number, StudentAnswerPayload> = {};
        for (const q of payload.questions) {
          mergedAnswers[q.id] = {
            question_id: q.id,
            selected_option: null,
            is_doubtful: false,
          };
        }
        for (const a of payload.answers) {
          mergedAnswers[a.question_id] = {
            question_id: a.question_id,
            selected_option: a.selected_option,
            is_doubtful: a.is_doubtful,
          };
        }

        // Preserve unsynced offline local answers if resuming the exact same session
        const preservedDirty = isSameSession ? get().dirtyQuestionIds : [];
        if (isSameSession) {
          const localAnswers = get().answers;
          for (const qid of preservedDirty) {
            if (localAnswers[qid]) {
              mergedAnswers[qid] = localAnswers[qid];
            }
          }
        }

        const serverNowMs = Date.parse(payload.server_now);
        const offset = Number.isFinite(serverNowMs) ? serverNowMs - Date.now() : 0;

        set({
          institution: payload.institution,
          participant: payload.participant,
          exam: payload.exam,
          session: payload.session,
          questions: payload.questions,
          answers: mergedAnswers,
          dirtyQuestionIds: preservedDirty,
          currentIndex: isSameSession
            ? Math.min(get().currentIndex, Math.max(payload.questions.length - 1, 0))
            : 0,
          serverOffsetMs: offset,
          syncStatus: preservedDirty.length > 0 ? 'offline' : 'synced',
          lastSyncedAt: payload.session.last_synced_at,
          violationsCount: payload.session.violations_count,
        });
      },

      setAnswer: (questionId, option) => {
        const prev = get().answers[questionId] || {
          question_id: questionId,
          selected_option: null,
          is_doubtful: false,
        };
        const dirty = new Set(get().dirtyQuestionIds);
        dirty.add(questionId);
        set({
          answers: {
            ...get().answers,
            [questionId]: {
              ...prev,
              selected_option: option,
            },
          },
          dirtyQuestionIds: Array.from(dirty),
        });
      },

      toggleDoubtful: (questionId) => {
        const prev = get().answers[questionId] || {
          question_id: questionId,
          selected_option: null,
          is_doubtful: false,
        };
        const dirty = new Set(get().dirtyQuestionIds);
        dirty.add(questionId);
        set({
          answers: {
            ...get().answers,
            [questionId]: {
              ...prev,
              is_doubtful: !prev.is_doubtful,
            },
          },
          dirtyQuestionIds: Array.from(dirty),
        });
      },

      setCurrentIndex: (index) => {
        const max = Math.max(get().questions.length - 1, 0);
        set({ currentIndex: Math.max(0, Math.min(index, max)) });
      },

      setFontScale: (fontScale) => set({ fontScale }),

      setSyncStatus: (syncStatus) => set({ syncStatus }),

      markSynced: (syncedIds, syncedAt) => {
        const remaining = get().dirtyQuestionIds.filter((id) => !syncedIds.includes(id));
        set({
          dirtyQuestionIds: remaining,
          lastSyncedAt: syncedAt,
          syncStatus: remaining.length === 0 ? 'synced' : get().syncStatus,
        });
      },

      setViolationsCount: (violationsCount) => set({ violationsCount }),

      clearExamSession: () =>
        set({
          participant: null,
          exam: null,
          session: null,
          questions: [],
          answers: {},
          dirtyQuestionIds: [],
          currentIndex: 0,
          syncStatus: 'synced',
          lastSyncedAt: null,
          violationsCount: 0,
        }),
    }),
    {
      name: 'cbt_active_exam_v1',
    }
  )
);
