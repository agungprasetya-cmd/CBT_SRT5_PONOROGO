import { CheckCircle2, Edit2, FileUp, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { QuestionEditorModal } from '../../components/admin/QuestionEditorModal';
import { WordQuestionImporter } from '../../components/admin/WordQuestionImporter';
import { MathRenderer } from '../../components/cbt/MathRenderer';
import { apiFetch } from '../../lib/api';
import type { AdminQuestion, Exam, OptionKey } from '../../types/cbt';

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

export const AdminQuestionsPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(0);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [wordImportOpen, setWordImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);

  const loadQuestions = useCallback(async (examId: number) => {
    if (!examId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ questions: AdminQuestion[] }>(
        `/api/admin/questions?exam_id=${examId}`,
        { admin: true }
      );
      setQuestions(res.questions);
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
          void loadQuestions(res.exams[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [loadQuestions]);

  const handleExamChange = (id: number) => {
    setSelectedExamId(id);
    void loadQuestions(id);
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/admin/questions/${id}`, { method: 'DELETE', admin: true });
    await loadQuestions(selectedExamId);
  };

  const getOptionText = (q: AdminQuestion, key: OptionKey) => {
    switch (key) {
      case 'A':
        return q.option_a;
      case 'B':
        return q.option_b;
      case 'C':
        return q.option_c;
      case 'D':
        return q.option_d;
      case 'E':
        return q.option_e;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Bank Soal
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Susun soal Matematika, Fisika, Kimia dengan pratinjau KaTeX real-time dan kompresi
            gambar stimulus otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!selectedExamId}
            onClick={() => setWordImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Import Word / Matematika
          </button>

          <button
            type="button"
            disabled={!selectedExamId}
            onClick={() => {
              setEditingQuestion(null);
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Tambah Soal Baru
          </button>
        </div>
      </div>

      {/* Exam Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Pilih Paket Ujian:
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => handleExamChange(Number(e.target.value))}
            className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.subject_name} — {ex.title}
              </option>
            ))}
          </select>
        </div>
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          Total: {questions.length} butir soal
        </span>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Paket ujian ini belum memiliki soal.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setWordImportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Import Kolektif Word / Matematika
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingQuestion(null);
                setEditorOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Buat Soal Pertama
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    Soal No. {q.question_number}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600 dark:text-slate-300 font-mono">
                    Bobot: {q.score_weight}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Kunci: {q.correct_answer}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestion(q);
                      setEditorOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                </div>
              </div>

              <MathRenderer
                content={q.question_text}
                className="text-sm text-slate-900 dark:text-slate-100"
              />

              {q.image_url && (
                <img
                  src={q.image_url}
                  alt={`Stimulus soal ${q.question_number}`}
                  referrerPolicy="no-referrer"
                  className="max-h-52 rounded-lg border border-slate-200 bg-white p-1 object-contain"
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                {OPTION_KEYS.map((key) => {
                  const isCorrect = q.correct_answer === key;
                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {key}
                      </span>
                      <MathRenderer content={getOptionText(q, key)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <QuestionEditorModal
        open={editorOpen}
        examId={selectedExamId}
        initialQuestion={editingQuestion}
        nextQuestionNumber={questions.length + 1}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void loadQuestions(selectedExamId)}
      />

      <WordQuestionImporter
        open={wordImportOpen}
        examId={selectedExamId}
        examTitle={
          exams.find((e) => e.id === selectedExamId)?.title || 'Paket Ujian'
        }
        existingCount={questions.length}
        onClose={() => setWordImportOpen(false)}
        onImported={() => void loadQuestions(selectedExamId)}
      />
    </div>
  );
};
