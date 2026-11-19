import { Edit2, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { Exam, ExamStatus } from '../../types/cbt';

export const AdminExamsPage: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);

  const [title, setTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [examToken, setExamToken] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [kkm, setKkm] = useState(75);
  const [status, setStatus] = useState<ExamStatus>('Aktif');
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [showResultToStudent, setShowResultToStudent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ exams: Exam[] }>('/api/admin/exams', { admin: true });
      setExams(res.exams);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setSubjectName('');
    setExamToken('');
    setDurationMinutes(90);
    setKkm(75);
    setStatus('Aktif');
    setRandomizeQuestions(true);
    setShowResultToStudent(true);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (ex: Exam) => {
    setEditing(ex);
    setTitle(ex.title);
    setSubjectName(ex.subject_name);
    setExamToken(ex.exam_token);
    setDurationMinutes(ex.duration_minutes);
    setKkm(ex.kkm);
    setStatus(ex.status);
    setRandomizeQuestions(ex.randomize_questions);
    setShowResultToStudent(ex.show_result_to_student);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        subject_name: subjectName.trim(),
        exam_token: examToken.trim().toUpperCase(),
        duration_minutes: Number(durationMinutes),
        kkm: Number(kkm),
        status,
        randomize_questions: randomizeQuestions,
        show_result_to_student: showResultToStudent,
      };
      if (editing) {
        await apiFetch(`/api/admin/exams/${editing.id}`, {
          method: 'PUT',
          admin: true,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/exams', {
          method: 'POST',
          admin: true,
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadExams();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan paket ujian.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex: Exam) => {
    await apiFetch(`/api/admin/exams/${ex.id}`, { method: 'DELETE', admin: true });
    await loadExams();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Manajemen Paket & Jadwal Ujian
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Atur mata pelajaran, token akses ruang, durasi, KKM, acak urutan soal, dan visibilitas
            nilai.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Buat Paket Ujian
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            Belum ada paket ujian. Klik &ldquo;Buat Paket Ujian&rdquo; untuk memulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3 font-semibold">Judul Paket Ujian</th>
                  <th className="px-5 py-3 font-semibold">Mata Pelajaran</th>
                  <th className="px-5 py-3 font-semibold">Token</th>
                  <th className="px-5 py-3 font-semibold text-right">Durasi</th>
                  <th className="px-5 py-3 font-semibold text-right">Soal</th>
                  <th className="px-5 py-3 font-semibold text-right">KKM</th>
                  <th className="px-5 py-3 font-semibold">Pengaturan</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {ex.title}
                    </td>
                    <td className="px-5 py-3.5">{ex.subject_name}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {ex.exam_token || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                      {ex.duration_minutes}m
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                      {ex.question_count ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums">{ex.kkm}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                      {ex.randomize_questions ? 'Acak Soal' : 'Urut'} ·{' '}
                      {ex.show_result_to_student ? 'Tampil Skor' : 'Skor Tersembunyi'}
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      {ex.status === 'Aktif' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Aktif</span>
                      ) : ex.status === 'Selesai' ? (
                        <span className="text-slate-500">Selesai</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Draft</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(ex)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={`Edit ${ex.title}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ex)}
                          className="rounded-md border border-rose-200 dark:border-rose-900 p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                          aria-label={`Hapus ${ex.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold">
                {editing ? 'Edit Paket Ujian' : 'Buat Paket Ujian Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Judul Paket Ujian</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: ASAS Biologi Kelas XII"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    required
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Biologi"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Token Ujian (Opsional)
                  </label>
                  <input
                    type="text"
                    value={examToken}
                    onChange={(e) => setExamToken(e.target.value.toUpperCase())}
                    placeholder="BIO2026"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    min={5}
                    max={360}
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">KKM</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={kkm}
                    onChange={(e) => setKkm(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status Ujian</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExamStatus)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Draft">Draft</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={(e) => setRandomizeQuestions(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Acak Urutan Soal Untuk Setiap Peserta
                </label>
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResultToStudent}
                    onChange={(e) => setShowResultToStudent(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Tampilkan Nilai & Status Kelulusan ke Siswa Setelah Selesai
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
