import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sigma,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { compressImageDataUrl } from '../../lib/image-compress';
import { MATH_SYMBOL_CATEGORIES } from '../../lib/math-symbols';
import {
  downloadQuestionTemplateWord,
  parseMathRawTextQuestions,
  parseWordQuestionsFile,
  type ParsedWordQuestion,
} from '../../lib/word-question-parser';
import type { OptionKey } from '../../types/cbt';
import { MathRenderer } from '../cbt/MathRenderer';

interface WordQuestionImporterProps {
  open: boolean;
  examId: number;
  examTitle: string;
  existingCount: number;
  onClose: () => void;
  onImported: () => void;
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

const SAMPLE_MATH_TEXT = `1. Nilai dari $\\int_{0}^{2} (3x^{2} + 2x)\\,dx$ adalah ...
A. 8
B. 10
C. 12
D. 14
E. 16
Kunci: C
Bobot: 2

2. Himpunan penyelesaian dari $\\sqrt{x + 5} \\leq 3$ dengan $x \\in \\mathbb{R}$ adalah ...
A. $-5 \\leq x \\leq 4$
B. $x \\leq 4$
C. $x \\geq -5$
D. $-3 \\leq x \\leq 4$
E. $x > 4$
Kunci: A
Bobot: 2

3. Jika $\\sin \\theta = \\frac{1}{2}$ dan $0^{\\circ} \\leq \\theta \\leq 90^{\\circ}$, maka besar sudut $\\theta$ adalah ...
A. 15°
B. 30°
C. 45°
D. 60°
E. 90°
Kunci: B`;

export const WordQuestionImporter: React.FC<WordQuestionImporterProps> = ({
  open,
  examId,
  examTitle,
  existingCount,
  onClose,
  onImported,
}) => {
  const [inputMode, setInputMode] = useState<'word' | 'math_text'>('word');
  const [rawMathText, setRawMathText] = useState('');
  const [activeSymbolTab, setActiveSymbolTab] = useState(MATH_SYMBOL_CATEGORIES[0].id);
  const mathTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [questions, setQuestions] = useState<ParsedWordQuestion[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formatInfo, setFormatInfo] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [defaultWeight, setDefaultWeight] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuestions([]);
    setFileName(null);
    setFormatInfo(null);
    setError(null);
    setResultMsg(null);
    setImportProgress(null);
    setReplaceExisting(false);
  }, [open, examId]);

  if (!open) return null;

  const insertMathSnippet = (snippet: string) => {
    const el = mathTextareaRef.current;
    if (!el) {
      setRawMathText((prev) => `${prev}${prev ? ' ' : ''}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? rawMathText.length;
    const end = el.selectionEnd ?? rawMathText.length;
    const next = rawMathText.slice(0, start) + snippet + rawMathText.slice(end);
    setRawMathText(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const applyParsedQuestions = (
    rawList: ParsedWordQuestion[],
    sourceLabel: string
  ) => {
    const startOffset = replaceExisting ? 0 : existingCount;
    const normalized = rawList.map((q, index) => ({
      ...q,
      question_number: startOffset + index + 1,
      score_weight: q.score_weight > 0 ? q.score_weight : defaultWeight,
    }));
    setQuestions(normalized);
    setFormatInfo(`Terdeteksi ${normalized.length} soal (${sourceLabel})`);
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setFormatInfo(null);

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError(
        'Gunakan file Microsoft Word berformat .docx (bukan .doc lama). Jika masih .doc, buka di Word lalu Save As menjadi .docx.'
      );
      return;
    }

    setFileName(file.name);
    setParsing(true);
    try {
      const res = await parseWordQuestionsFile(file);
      if (res.questions.length === 0) {
        setQuestions([]);
        setError(
          'Tidak ditemukan butir soal yang valid di dokumen Word ini. Unduh Template Word di atas untuk melihat format tabel atau format teks yang didukung.'
        );
        return;
      }

      const formatLabel =
        res.format_detected === 'table'
          ? 'Format Tabel Word & Equation'
          : res.format_detected === 'mixed'
          ? 'Kombinasi Tabel & Teks'
          : 'Format Teks Word & Equation';
      applyParsedQuestions(res.questions, formatLabel);
    } catch {
      setQuestions([]);
      setError('Gagal membaca file Word (.docx). Pastikan file tidak rusak atau diproteksi password.');
    } finally {
      setParsing(false);
    }
  };

  const handleParseMathText = () => {
    setError(null);
    setResultMsg(null);
    setFormatInfo(null);

    if (!rawMathText.trim()) {
      setError('Tempel atau ketik soal matematika beserta opsi A–E terlebih dahulu.');
      return;
    }

    const parsed = parseMathRawTextQuestions(rawMathText);
    if (parsed.length === 0) {
      setQuestions([]);
      setError(
        'Format soal belum terbaca. Pastikan setiap soal diawali nomor (contoh: 1. ...) dan diikuti opsi A. B. C. D. (dan E. opsional).'
      );
      return;
    }

    applyParsedQuestions(parsed, 'Input Teks & Simbol Matematika');
  };

  const handleToggleReplace = (nextReplace: boolean) => {
    setReplaceExisting(nextReplace);
    const startOffset = nextReplace ? 0 : existingCount;
    setQuestions((prev) =>
      prev.map((q, idx) => ({
        ...q,
        question_number: startOffset + idx + 1,
      }))
    );
  };

  const applyDefaultWeightToAll = (val: number) => {
    const safeVal = Number.isFinite(val) && val > 0 ? val : 1;
    setDefaultWeight(safeVal);
    setQuestions((prev) => prev.map((q) => ({ ...q, score_weight: safeVal })));
  };

  const updateQuestionField = <K extends keyof ParsedWordQuestion>(
    tempId: string,
    field: K,
    value: ParsedWordQuestion[K]
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.temp_id !== tempId) return q;
        const updated = { ...q, [field]: value };
        if (field === 'correct_answer') {
          updated.answer_detected = true;
          updated.warnings = updated.warnings.filter(
            (w) => !w.includes('Kunci jawaban belum terdeteksi')
          );
        }
        return updated;
      })
    );
  };

  const removeQuestion = (tempId: string) => {
    const startOffset = replaceExisting ? 0 : existingCount;
    setQuestions((prev) =>
      prev
        .filter((q) => q.temp_id !== tempId)
        .map((q, idx) => ({ ...q, question_number: startOffset + idx + 1 }))
    );
  };

  const uploadEmbeddedImage = async (
    rawDataUrl: string | null,
    prefix: string
  ): Promise<string | null> => {
    if (!rawDataUrl) return null;
    const compressed = await compressImageDataUrl(rawDataUrl);
    const uploaded = await apiFetch<{ url: string }>('/api/admin/upload-image', {
      method: 'POST',
      admin: true,
      body: JSON.stringify({
        data_url: compressed.dataUrl,
        prefix,
      }),
    });
    return uploaded.url;
  };

  const handleImport = async () => {
    if (questions.length === 0 || !examId) return;
    setImporting(true);
    setError(null);
    setResultMsg(null);

    try {
      const prepared: Array<{
        question_number: number;
        question_text: string;
        image_url: string | null;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        option_e: string;
        option_a_image: string | null;
        option_b_image: string | null;
        option_c_image: string | null;
        option_d_image: string | null;
        option_e_image: string | null;
        correct_answer: OptionKey;
        score_weight: number;
      }> = [];

      const totalImages = questions.reduce((acc, q) => {
        return (
          acc +
          (q.image_data_url ? 1 : 0) +
          (q.option_a_image_data_url ? 1 : 0) +
          (q.option_b_image_data_url ? 1 : 0) +
          (q.option_c_image_data_url ? 1 : 0) +
          (q.option_d_image_data_url ? 1 : 0) +
          (q.option_e_image_data_url ? 1 : 0)
        );
      }, 0);

      let uploadedImgCount = 0;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const uploadWithProgress = async (raw: string | null, prefix: string) => {
          if (!raw) return null;
          uploadedImgCount += 1;
          setImportProgress(`Mengompres & mengunggah gambar ${uploadedImgCount}/${totalImages}...`);
          return uploadEmbeddedImage(raw, prefix);
        };

        const imageUrl = await uploadWithProgress(q.image_data_url, `word_q${q.question_number}`);
        const optAImg = await uploadWithProgress(q.option_a_image_data_url, `word_q${q.question_number}_a`);
        const optBImg = await uploadWithProgress(q.option_b_image_data_url, `word_q${q.question_number}_b`);
        const optCImg = await uploadWithProgress(q.option_c_image_data_url, `word_q${q.question_number}_c`);
        const optDImg = await uploadWithProgress(q.option_d_image_data_url, `word_q${q.question_number}_d`);
        const optEImg = await uploadWithProgress(q.option_e_image_data_url, `word_q${q.question_number}_e`);

        prepared.push({
          question_number: q.question_number,
          question_text: q.question_text.trim() || 'Perhatikan gambar berikut!',
          image_url: imageUrl,
          option_a: q.option_a.trim() || '-',
          option_b: q.option_b.trim() || '-',
          option_c: q.option_c.trim() || '-',
          option_d: q.option_d.trim() || '-',
          option_e: q.option_e.trim() || '-',
          option_a_image: optAImg,
          option_b_image: optBImg,
          option_c_image: optCImg,
          option_d_image: optDImg,
          option_e_image: optEImg,
          correct_answer: q.correct_answer,
          score_weight: q.score_weight > 0 ? q.score_weight : 1,
        });
      }

      setImportProgress(`Menyimpan ${prepared.length} butir soal ke database...`);
      const res = await apiFetch<{ inserted: number; replaced: boolean }>(
        '/api/admin/questions/bulk',
        {
          method: 'POST',
          admin: true,
          body: JSON.stringify({
            exam_id: examId,
            replace_existing: replaceExisting,
            questions: prepared,
          }),
        }
      );

      setResultMsg(
        `Berhasil mengimpor ${res.inserted} butir soal secara kolektif ke paket "${examTitle}".`
      );
      setQuestions([]);
      onImported();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengimpor soal kolektif.');
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const undetectedKeyCount = questions.filter((q) => !q.answer_detected).length;
  const currentCategory =
    MATH_SYMBOL_CATEGORIES.find((c) => c.id === activeSymbolTab) || MATH_SYMBOL_CATEGORIES[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sigma className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Import Kolektif Word (.docx) &amp; Soal Matematika
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Target Paket Ujian:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {examTitle}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Input Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setInputMode('word');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                inputMode === 'word'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Upload File Word (.docx)
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('math_text');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                inputMode === 'math_text'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sigma className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Input / Tempel Soal Matematika
            </button>
          </div>

          {inputMode === 'word' ? (
            <>
              {/* Template & Format Guide */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    1. Mendukung Word Equation Asli, Simbol Matematika, Tabel &amp; Gambar
                  </p>
                  <p>
                    Rumus yang dibuat dengan <span className="font-semibold">Insert → Equation</span>{' '}
                    di Microsoft Word otomatis dibaca menjadi KaTeX, selain format tabel, teks{' '}
                    <span className="font-mono font-semibold">1. / A–E / Kunci:</span>, dan simbol{' '}
                    <span className="font-mono">√, ∫, ∑, ≤, ≥, π, θ</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadQuestionTemplateWord()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Download Template (.docx)
                </button>
              </div>

              {/* Upload Zone */}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center hover:border-blue-500 transition-colors">
                {parsing ? (
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                ) : (
                  <Upload className="h-7 w-7 text-slate-400" />
                )}
                <span className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {parsing
                    ? 'Membaca Word Equation & memproses dokumen...'
                    : fileName || 'Pilih file Microsoft Word (.docx) berisi kumpulan soal'}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Mendukung rumus Equation Word, pecahan, akar, integral, matriks, dan gambar stimulus.
                </span>
                <input
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileChange(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Tempel atau Ketik Kumpulan Soal Matematika (dengan Simbol Khusus / LaTeX)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mendukung simbol Unicode (<span className="font-mono">√(x+1), ½, ≤, ≥, ≠, π, θ, ∫, ∑, °</span>)
                    maupun sintaks LaTeX (<span className="font-mono">$...$</span>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRawMathText(SAMPLE_MATH_TEXT)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Muat Contoh Matematika
                </button>
              </div>

              {/* Categorized Math Symbol Palette */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {MATH_SYMBOL_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveSymbolTab(cat.id)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        activeSymbolTab === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentCategory.items.map((item) => (
                    <button
                      key={item.label + item.snippet}
                      type="button"
                      title={item.title}
                      onClick={() => insertMathSnippet(item.snippet)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition-colors"
                    >
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.preview}
                      </span>
                      {item.label !== item.preview && <span>{item.label}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={mathTextareaRef}
                rows={8}
                value={rawMathText}
                onChange={(e) => setRawMathText(e.target.value)}
                placeholder={`Contoh:\n1. Tentukan nilai dari $\\frac{3}{4} + \\sqrt{16}$ adalah ...\nA. 4,25\nB. 4,75\nC. 5,25\nD. 5,75\nE. 6,00\nKunci: B\nBobot: 2`}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseMathText}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
                >
                  <Sigma className="h-3.5 w-3.5" />
                  Baca &amp; Pratinjau Soal Matematika
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          {resultMsg && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {resultMsg}
            </div>
          )}

          {/* Parsed Questions Preview */}
          {questions.length > 0 && (
            <div className="space-y-4">
              {/* Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatInfo}
                  </span>
                  {undetectedKeyCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium tabular-nums">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {undetectedKeyCount} soal kunci default A (cek di bawah)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="font-medium">Set Bobot Semua:</span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={defaultWeight}
                      onChange={(e) => applyDefaultWeightToAll(Number(e.target.value))}
                      className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono text-xs"
                    />
                  </label>

                  {existingCount > 0 && (
                    <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={replaceExisting}
                        onChange={(e) => handleToggleReplace(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span>Ganti {existingCount} soal lama pada paket ini</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Preview Cards */}
              <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                {questions.map((q) => (
                  <div
                    key={q.temp_id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      !q.answer_detected || q.warnings.length > 0
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          No. {q.question_number}
                        </span>
                        {q.image_data_url && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            <ImageIcon className="h-3 w-3" />
                            Ada Gambar Stimulus
                          </span>
                        )}
                        {q.warnings.map((w, wi) => (
                          <span
                            key={wi}
                            className="text-[11px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            · {w}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <label className="inline-flex items-center gap-1.5">
                          <span className="text-slate-500">Kunci:</span>
                          <select
                            value={q.correct_answer}
                            onChange={(e) =>
                              updateQuestionField(
                                q.temp_id,
                                'correct_answer',
                                e.target.value as OptionKey
                              )
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono font-bold text-emerald-700 dark:text-emerald-400"
                          >
                            {OPTION_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="inline-flex items-center gap-1.5">
                          <span className="text-slate-500">Bobot:</span>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={q.score_weight}
                            onChange={(e) =>
                              updateQuestionField(
                                q.temp_id,
                                'score_weight',
                                Number(e.target.value) || 1
                              )
                            }
                            className="w-14 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => removeQuestion(q.temp_id)}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                          title="Hapus soal ini dari daftar impor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <MathRenderer
                      content={q.question_text}
                      className="text-xs text-slate-900 dark:text-slate-100"
                    />

                    {q.image_data_url && (
                      <img
                        src={q.image_data_url}
                        alt={`Gambar soal ${q.question_number}`}
                        className="max-h-28 rounded-lg border border-slate-200 bg-white p-1 object-contain"
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-[11px]">
                      {OPTION_KEYS.map((k) => {
                        const val =
                          k === 'A'
                            ? q.option_a
                            : k === 'B'
                            ? q.option_b
                            : k === 'C'
                            ? q.option_c
                            : k === 'D'
                            ? q.option_d
                            : q.option_e;
                        const isKey = q.correct_answer === k;
                        return (
                          <div
                            key={k}
                            className={`flex items-start gap-1.5 rounded border px-2 py-1 ${
                              isKey
                                ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/40'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span
                              className={`font-mono font-bold ${
                                isKey
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {k}.
                            </span>
                            <div className="flex-1 min-w-0 text-slate-700 dark:text-slate-300">
                              <MathRenderer content={val} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {importProgress ||
              (questions.length > 0
                ? `${questions.length} soal siap disimpan ke database.`
                : 'Belum ada soal siap impor.')}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={questions.length === 0 || importing}
              onClick={() => void handleImport()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {importing
                ? 'Menyimpan...'
                : `Impor ${questions.length} Soal ke Bank Soal`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
