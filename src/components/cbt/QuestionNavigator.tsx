import React, { useMemo, useState } from 'react';
import type { StudentAnswerPayload, StudentQuestion } from '../../types/cbt';

type FilterMode = 'all' | 'answered' | 'doubtful' | 'empty';

interface QuestionNavigatorProps {
  questions: StudentQuestion[];
  answers: Record<number, StudentAnswerPayload>;
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questions,
  answers,
  currentIndex,
  onSelectIndex,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');

  const stats = useMemo(() => {
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

  const filteredItems = useMemo(() => {
    return questions
      .map((q, index) => {
        const a = answers[q.id];
        const isAnswered = Boolean(a?.selected_option);
        const isDoubtful = Boolean(a?.is_doubtful);
        return { q, index, isAnswered, isDoubtful, selected: a?.selected_option };
      })
      .filter((item) => {
        if (filter === 'answered') return item.isAnswered && !item.isDoubtful;
        if (filter === 'doubtful') return item.isDoubtful;
        if (filter === 'empty') return !item.isAnswered;
        return true;
      });
  }, [questions, answers, filter]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Navigasi Matriks Soal
          </h2>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {stats.answered}/{stats.total} Dijawab
          </span>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          {(
            [
              ['all', `Semua (${stats.total})`],
              ['answered', `Isi (${stats.answered})`],
              ['doubtful', `Ragu (${stats.doubtful})`],
              ['empty', `Kosong (${stats.empty})`],
            ] as Array<[FilterMode, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium whitespace-nowrap truncate transition-colors ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Number Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada soal pada filter ini.
          </p>
        ) : (
          <div className="grid grid-cols-5 gap-2.5">
            {filteredItems.map((item) => {
              const isCurrent = item.index === currentIndex;
              let colorClass =
                'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600';

              if (isCurrent) {
                colorClass =
                  'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-600/25';
              } else if (item.isDoubtful) {
                colorClass =
                  'border-amber-500 bg-amber-400 text-slate-950 hover:bg-amber-300 dark:border-amber-500 dark:bg-amber-500 dark:text-slate-950';
              } else if (item.isAnswered) {
                colorClass =
                  'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500';
              }

              return (
                <button
                  key={item.q.id}
                  type="button"
                  onClick={() => onSelectIndex(item.index)}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-lg border font-mono text-sm font-semibold tabular-nums transition-all ${colorClass}`}
                  aria-label={`Soal nomor ${item.index + 1}${
                    item.selected ? `, terjawab ${item.selected}` : ', belum dijawab'
                  }${item.isDoubtful ? ', ditandai ragu-ragu' : ''}`}
                >
                  <span>{item.index + 1}</span>
                  {item.selected && (
                    <span className="text-[10px] leading-none opacity-90">
                      {item.selected}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded bg-blue-600 inline-block shrink-0" />
            <span>Nomor Aktif</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded bg-emerald-600 inline-block shrink-0" />
            <span>Sudah Dijawab</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded bg-amber-400 border border-amber-500 inline-block shrink-0" />
            <span>Ragu-ragu</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 inline-block shrink-0" />
            <span>Belum Dijawab</span>
          </div>
        </div>
      </div>
    </div>
  );
};
