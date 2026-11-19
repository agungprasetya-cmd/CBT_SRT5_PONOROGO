import { CheckCircle2, Code2, Copy, Download, ImagePlus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { compressImageToDataUrl } from '../../lib/image-compress';
import type { AdminInstitutionSettings } from '../../types/cbt';

export const AdminSettingsPage: React.FC = () => {
  const [schoolName, setSchoolName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [examEventName, setExamEventName] = useState('');
  const [defaultKkm, setDefaultKkm] = useState(75);
  const [proctorPin, setProctorPin] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sqlBlueprint, setSqlBlueprint] = useState<string>('');
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ settings: AdminInstitutionSettings }>('/api/admin/settings', { admin: true }),
      apiFetch<{ sql: string }>('/api/admin/schema-sql', { admin: true }),
    ])
      .then(([sRes, sqlRes]) => {
        const s = sRes.settings;
        setSchoolName(s.school_name);
        setLogoUrl(s.logo_url);
        setAcademicYear(s.academic_year);
        setExamEventName(s.exam_event_name);
        setDefaultKkm(s.default_kkm);
        setProctorPin(s.proctor_pin);
        setSqlBlueprint(sqlRes.sql);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { dataUrl } = await compressImageToDataUrl(file, 350 * 1024, 512);
      const uploaded = await apiFetch<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ data_url: dataUrl, prefix: 'logo_sekolah' }),
      });
      setLogoUrl(uploaded.url);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengunggah logo.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedBanner(false);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        admin: true,
        body: JSON.stringify({
          school_name: schoolName,
          logo_url: logoUrl,
          academic_year: academicYear,
          exam_event_name: examEventName,
          default_kkm: Number(defaultKkm),
          proctor_pin: proctorPin,
        }),
      });
      setSavedBanner(true);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlBlueprint], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cbt_supabase_postgres_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="h-80 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Pengaturan Satuan Pendidikan
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Identitas sekolah/madrasah akan tampil pada layar login peserta, kop cetak kartu, dan
          laporan hasil PDF.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
      >
        {savedBanner && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60 px-4 py-3 text-xs font-medium text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Pengaturan satuan pendidikan berhasil diperbarui.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1.5 overflow-hidden">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo Sekolah"
                className="h-full w-full object-contain rounded"
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Logo Sekolah / Madrasah
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">
              <ImagePlus className="h-4 w-4" />
              Unggah Logo Baru
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Sekolah / Madrasah
            </label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Kegiatan Ujian
            </label>
            <input
              type="text"
              required
              value={examEventName}
              onChange={(e) => setExamEventName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tahun Pelajaran
            </label>
            <input
              type="text"
              required
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              KKM Default (0 – 100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              required
              value={defaultKkm}
              onChange={(e) => setDefaultKkm(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              PIN Proktor Ruangan
            </label>
            <input
              type="text"
              minLength={4}
              maxLength={12}
              required
              value={proctorPin}
              onChange={(e) => setProctorPin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>

      {/* PostgreSQL / Supabase Architecture Blueprint Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-600" />
              Cetak Biru Skema PostgreSQL / Supabase (DDL + Indeks + RLS)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Skrip SQL siap pakai untuk migrasi klaster produksi Supabase dengan isolasi kunci
              jawaban.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSql((v) => !v)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {showSql ? 'Sembunyikan SQL' : 'Lihat Skrip SQL'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh .SQL
            </button>
          </div>
        </div>

        {showSql && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sqlBlueprint);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
            >
              <Copy className="h-3 w-3" />
              {copiedSql ? 'Tersalin' : 'Salin'}
            </button>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200">
              {sqlBlueprint}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
