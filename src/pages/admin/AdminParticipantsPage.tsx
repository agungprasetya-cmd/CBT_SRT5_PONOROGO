import {
  Edit2,
  FileSpreadsheet,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExcelParticipantImporter } from '../../components/admin/ExcelParticipantImporter';
import { apiFetch } from '../../lib/api';
import { exportParticipantCardsPdf } from '../../lib/export-utils';
import type { InstitutionSettings, Participant } from '../../types/cbt';

export const AdminParticipantsPage: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [institution, setInstitution] = useState<InstitutionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');

  const [importerOpen, setImporterOpen] = useState(false);
  const [formModal, setFormModal] = useState<{
    open: boolean;
    editing: Participant | null;
  }>({ open: false, editing: null });

  const [examNumber, setExamNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        apiFetch<{ participants: Participant[] }>('/api/admin/participants', { admin: true }),
        apiFetch<{ settings: InstitutionSettings }>('/api/admin/settings', { admin: true }),
      ]);
      setParticipants(pRes.participants);
      setInstitution(sRes.settings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const classOptions = useMemo(() => {
    const set = new Set(participants.map((p) => p.class_name));
    return ['ALL', ...Array.from(set).sort()];
  }, [participants]);

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      if (classFilter !== 'ALL' && p.class_name !== classFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.exam_number.toLowerCase().includes(q) ||
          p.full_name.toLowerCase().includes(q) ||
          p.class_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [participants, classFilter, search]);

  const openCreateModal = () => {
    setFormError(null);
    setExamNumber('');
    setFullName('');
    setClassName('');
    setIsActive(true);
    setFormModal({ open: true, editing: null });
  };

  const openEditModal = (p: Participant) => {
    setFormError(null);
    setExamNumber(p.exam_number);
    setFullName(p.full_name);
    setClassName(p.class_name);
    setIsActive(p.is_active);
    setFormModal({ open: true, editing: p });
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        exam_number: examNumber.trim(),
        full_name: fullName.trim(),
        class_name: className.trim(),
        is_active: isActive,
      };
      if (formModal.editing) {
        await apiFetch(`/api/admin/participants/${formModal.editing.id}`, {
          method: 'PUT',
          admin: true,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/participants', {
          method: 'POST',
          admin: true,
          body: JSON.stringify(payload),
        });
      }
      setFormModal({ open: false, editing: null });
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data peserta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Participant) => {
    await apiFetch(`/api/admin/participants/${p.id}`, { method: 'DELETE', admin: true });
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Manajemen Data Peserta
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kelola nomor peserta, rombel kelas, impor massal Excel, dan cetak kartu ujian PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={filtered.length === 0}
            onClick={() => exportParticipantCardsPdf(filtered, institution)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            Cetak Kartu PDF
          </button>
          <button
            type="button"
            onClick={() => setImporterOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Tambah Peserta
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor peserta, nama, atau kelas..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
        >
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {c === 'ALL' ? 'Semua Kelas' : c}
            </option>
          ))}
        </select>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2 tabular-nums">
          Total: {filtered.length} peserta
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Tidak ada data peserta yang sesuai dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3 font-semibold">No. Peserta</th>
                  <th className="px-5 py-3 font-semibold">Nama Lengkap</th>
                  <th className="px-5 py-3 font-semibold">Kelas / Rombel</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono font-semibold">{p.exam_number}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {p.full_name}
                    </td>
                    <td className="px-5 py-3">{p.class_name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`font-medium ${
                          p.is_active
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label={`Edit ${p.full_name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="rounded-md border border-rose-200 dark:border-rose-900 p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                          aria-label={`Hapus ${p.full_name}`}
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

      {/* Create/Edit Modal */}
      {formModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold">
                {formModal.editing ? 'Edit Data Peserta' : 'Tambah Peserta Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormModal({ open: false, editing: null })}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParticipant} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Nomor Peserta</label>
                <input
                  type="text"
                  required
                  value={examNumber}
                  onChange={(e) => setExamNumber(e.target.value)}
                  placeholder="2026-XII-013"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Kelas / Rombel</label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="XII IPA 1"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                Status Peserta Aktif (Diizinkan Mengikuti Ujian)
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setFormModal({ open: false, editing: null })}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ExcelParticipantImporter
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        onImported={loadData}
      />
    </div>
  );
};
