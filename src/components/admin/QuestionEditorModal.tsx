import { Eye, ImagePlus, Loader2, Sigma, Sparkles, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { compressImageToDataUrl } from '../../lib/image-compress';
import { MATH_SYMBOL_CATEGORIES } from '../../lib/math-symbols';
import { normalizeMathText } from '../../lib/omml-to-latex';
import type { AdminQuestion, OptionKey } from '../../types/cbt';
import { MathRenderer } from '../cbt/MathRenderer';

interface QuestionEditorModalProps {
  open: boolean;
  examId: number;
  initialQuestion: AdminQuestion | null;
  nextQuestionNumber: number;
  onClose: () => void;
  onSaved: (question: AdminQuestion, isNew: boolean) => void;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  open,
  examId,
  initialQuestion,
  nextQuestionNumber,
  onClose,
  onSaved,
}) => {
  const [questionNumber, setQuestionNumber] = useState(nextQuestionNumber);
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [optionE, setOptionE] = useState('');
  const [optionImages, setOptionImages] = useState<Record<OptionKey, string | null>>({
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
  });
  const [correctAnswer, setCorrectAnswer] = useState<OptionKey>('A');
  const [scoreWeight, setScoreWeight] = useState<number>(10);

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'live' | 'student'>('live');
  const [symbolTab, setSymbolTab] = useState<string>(MATH_SYMBOL_CATEGORIES[0].id);
  const [activeField, setActiveField] = useState<'question' | OptionKey>('question');

  const questionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optionInputRefs = useRef<Record<OptionKey, HTMLInputElement | null>>({
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setActiveField('question');
    if (initialQuestion) {
      setQuestionNumber(initialQuestion.question_number);
      setQuestionText(initialQuestion.question_text);
      setImageUrl(initialQuestion.image_url);
      setOptionA(initialQuestion.option_a);
      setOptionB(initialQuestion.option_b);
      setOptionC(initialQuestion.option_c);
      setOptionD(initialQuestion.option_d);
      setOptionE(initialQuestion.option_e);
      setOptionImages({
        A: initialQuestion.option_a_image,
        B: initialQuestion.option_b_image,
        C: initialQuestion.option_c_image,
        D: initialQuestion.option_d_image,
        E: initialQuestion.option_e_image,
      });
      setCorrectAnswer(initialQuestion.correct_answer);
      setScoreWeight(initialQuestion.score_weight);
    } else {
      setQuestionNumber(nextQuestionNumber);
      setQuestionText('');
      setImageUrl(null);
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setOptionE('');
      setOptionImages({ A: null, B: null, C: null, D: null, E: null });
      setCorrectAnswer('A');
      setScoreWeight(10);
    }
  }, [open, initialQuestion, nextQuestionNumber]);

  if (!open) return null;

  const insertSnippet = (snippet: string) => {
    if (activeField === 'question') {
      const el = questionTextareaRef.current;
      if (!el) {
        setQuestionText((prev) => `${prev} ${snippet}`.trim());
        return;
      }
      const start = el.selectionStart ?? questionText.length;
      const end = el.selectionEnd ?? questionText.length;
      const next = questionText.slice(0, start) + snippet + questionText.slice(end);
      setQuestionText(next);
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + snippet.length;
        el.setSelectionRange(cursor, cursor);
      });
      return;
    }

    const optKey = activeField;
    const el = optionInputRefs.current[optKey];
    const currentVal = getOptionVal(optKey);
    if (!el) {
      setOptionVal(optKey, `${currentVal} ${snippet}`.trim());
      return;
    }
    const start = el.selectionStart ?? currentVal.length;
    const end = el.selectionEnd ?? currentVal.length;
    const next = currentVal.slice(0, start) + snippet + currentVal.slice(end);
    setOptionVal(optKey, next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleNormalizeAllMath = () => {
    setQuestionText((prev) => normalizeMathText(prev));
    setOptionA((prev) => normalizeMathText(prev));
    setOptionB((prev) => normalizeMathText(prev));
    setOptionC((prev) => normalizeMathText(prev));
    setOptionD((prev) => normalizeMathText(prev));
    setOptionE((prev) => normalizeMathText(prev));
  };

  const handleImageUpload = async (
    file: File | undefined,
    target: 'stimulus' | OptionKey
  ) => {
    if (!file) return;
    setError(null);
    setUploadingField(target);
    try {
      const { dataUrl } = await compressImageToDataUrl(file, 500 * 1024, 1280);
      const uploaded = await apiFetch<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({
          data_url: dataUrl,
          prefix: target === 'stimulus' ? 'soal' : `opsi_${target}`,
        }),
      });
      if (target === 'stimulus') {
        setImageUrl(uploaded.url);
      } else {
        setOptionImages((prev) => ({ ...prev, [target]: uploaded.url }));
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mengunggah gambar terkompresi.');
    } finally {
      setUploadingField(null);
    }
  };

  const getOptionVal = (key: OptionKey) => {
    switch (key) {
      case 'A':
        return optionA;
      case 'B':
        return optionB;
      case 'C':
        return optionC;
      case 'D':
        return optionD;
      case 'E':
        return optionE;
    }
  };

  const setOptionVal = (key: OptionKey, val: string) => {
    switch (key) {
      case 'A':
        setOptionA(val);
        break;
      case 'B':
        setOptionB(val);
        break;
      case 'C':
        setOptionC(val);
        break;
      case 'D':
        setOptionD(val);
        break;
      case 'E':
        setOptionE(val);
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        exam_id: examId,
        question_number: Number(questionNumber),
        question_text: questionText,
        image_url: imageUrl,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        option_e: optionE,
        option_a_image: optionImages.A,
        option_b_image: optionImages.B,
        option_c_image: optionImages.C,
        option_d_image: optionImages.D,
        option_e_image: optionImages.E,
        correct_answer: correctAnswer,
        score_weight: Number(scoreWeight),
      };

      if (initialQuestion) {
        const res = await apiFetch<{ question: AdminQuestion }>(
          `/api/admin/questions/${initialQuestion.id}`,
          {
            method: 'PUT',
            admin: true,
            body: JSON.stringify(payload),
          }
        );
        onSaved(res.question, false);
      } else {
        const res = await apiFetch<{ question: AdminQuestion }>('/api/admin/questions', {
          method: 'POST',
          admin: true,
          body: JSON.stringify(payload),
        });
        onSaved(res.question, true);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan soal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {initialQuestion ? `Edit Soal No. ${initialQuestion.question_number}` : 'Tambah Soal Baru'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gunakan <code className="font-mono">$...$</code> untuk rumus sebaris dan{' '}
              <code className="font-mono">$$...$$</code> untuk rumus blok KaTeX.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split */}
        <form onSubmit={handleSubmit} className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Left Form Editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
            {error && (
              <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Urut
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={questionNumber}
                  onChange={(e) => setQuestionNumber(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bobot Skor
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.5"
                  required
                  value={scoreWeight}
                  onChange={(e) => setScoreWeight(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kunci Jawaban
                </label>
                <select
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value as OptionKey)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm font-bold"
                >
                  {OPTION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      Opsi {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Categorized Special Math Symbol Toolbar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sigma className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Palet Simbol Khusus Matematika
                  </span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    Target: {activeField === 'question' ? 'Pertanyaan' : `Opsi ${activeField}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNormalizeAllMath}
                  title="Konversi simbol tempelan seperti √(x+1), ½, ¾ menjadi rumus KaTeX"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  Rapikan Simbol ke KaTeX
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                {MATH_SYMBOL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSymbolTab(cat.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      symbolTab === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  MATH_SYMBOL_CATEGORIES.find((c) => c.id === symbolTab) ||
                  MATH_SYMBOL_CATEGORIES[0]
                ).items.map((item) => (
                  <button
                    key={item.label + item.snippet}
                    type="button"
                    title={item.title}
                    onClick={() => insertSnippet(item.snippet)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.preview}
                    </span>
                    {item.label !== item.preview && <span>{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Wacana / Pertanyaan Soal
              </label>
              <textarea
                ref={questionTextareaRef}
                rows={4}
                required
                value={questionText}
                onFocus={() => setActiveField('question')}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Tulis atau tempel soal matematika. Contoh: Tentukan nilai dari $\int_0^2 x^2\,dx$..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Stimulus Image Upload */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Gambar Stimulus Soal (Opsional)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Otomatis dikompresi maksimal 500KB sebelum disimpan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">
                    {uploadingField === 'stimulus' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Unggah Gambar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], 'stimulus')}
                    />
                  </label>
                </div>
              </div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview stimulus"
                  className="mt-3 max-h-36 rounded border border-slate-200 dark:border-slate-700 bg-white p-1 object-contain"
                />
              )}
            </div>

            {/* Options A-E */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pilihan Jawaban (A – E)
              </p>
              {OPTION_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-xs font-bold ${
                        correctAnswer === key
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {key}
                    </span>
                    <input
                      ref={(el) => {
                        optionInputRefs.current[key] = el;
                      }}
                      type="text"
                      required
                      value={getOptionVal(key)}
                      onFocus={() => setActiveField(key)}
                      onChange={(e) => setOptionVal(key, e.target.value)}
                      placeholder={`Teks atau rumus LaTeX untuk opsi ${key}`}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0">
                      <ImagePlus className="h-3.5 w-3.5" />
                      Gambar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e.target.files?.[0], key)}
                      />
                    </label>
                  </div>
                  {optionImages[key] && (
                    <div className="flex items-center gap-3 pl-9">
                      <img
                        src={optionImages[key]!}
                        alt={`Opsi ${key}`}
                        className="max-h-20 rounded border border-slate-200 bg-white p-0.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setOptionImages((prev) => ({ ...prev, [key]: null }))
                        }
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Real-Time KaTeX & Student Card Preview */}
          <div className="w-full lg:w-[44%] flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <Eye className="h-4 w-4 text-blue-600" />
                Pratinjau KaTeX Real-Time
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('live')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    previewTab === 'live'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Ringkas
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('student')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    previewTab === 'student'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Layar Siswa
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono font-bold text-blue-600">
                    Soal No. {questionNumber}
                  </span>
                  <span>Bobot: {scoreWeight}</span>
                </div>
                {questionText ? (
                  <MathRenderer
                    content={questionText}
                    className="text-sm text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <p className="text-xs italic text-slate-400">
                    Hasil render pertanyaan & rumus KaTeX akan tampil di sini...
                  </p>
                )}

                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Stimulus"
                    className="mt-4 max-h-48 rounded-lg border border-slate-200 bg-white p-1 object-contain"
                  />
                )}
              </div>

              <div className="space-y-2">
                {OPTION_KEYS.map((key) => {
                  const text = getOptionVal(key);
                  const isKey = correctAnswer === key && previewTab === 'live';
                  return (
                    <div
                      key={key}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${
                        isKey
                          ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-bold ${
                          isKey
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {key}
                      </span>
                      <div className="flex-1 min-w-0">
                        <MathRenderer content={text || `Opsi ${key}...`} />
                        {optionImages[key] && (
                          <img
                            src={optionImages[key]!}
                            alt={`Opsi ${key}`}
                            className="mt-2 max-h-24 rounded border bg-white p-0.5"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Soal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
