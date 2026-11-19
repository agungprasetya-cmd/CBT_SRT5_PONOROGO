import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../lib/api';
import { downloadParticipantTemplateExcel } from '../../lib/export-utils';

interface ParsedRow {
  exam_number: string;
  full_name: string;
  class_name: string;
  is_active: boolean;
}

interface ExcelParticipantImporterProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export const ExcelParticipantImporter: React.FC<ExcelParticipantImporterProps> = ({
  open,
  onClose,
  onImported,
}) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, {
        defval: '',
      });

      const normalized: ParsedRow[] = rawJson
        .map((item) => {
          const examNum = String(
            item['Nomor Peserta'] ?? item['exam_number'] ?? item['No Peserta'] ?? ''
          ).trim();
          const fullName = String(
            item['Nama Lengkap'] ?? item['full_name'] ?? item['Nama'] ?? ''
          ).trim();
          const className = String(
            item['Kelas / Rombel'] ?? item['class_name'] ?? item['Kelas'] ?? ''
          ).trim();
          const statusRaw = String(
            item['Status Aktif'] ?? item['is_active'] ?? 'AKTIF'
          )
            .trim()
            .toUpperCase();
          const isActive = statusRaw !== 'NONAKTIF' && statusRaw !== 'FALSE' && statusRaw !== '0';

          return {
            exam_number: examNum,
            full_name: fullName,
            class_name: className,
            is_active: isActive,
          };
        })
        .filter((r) => r.exam_number && r.full_name && r.class_name);

      if (normalized.length === 0) {
        setError(
          'Tidak ditemukan baris valid. Pastikan kolom bernama: Nomor Peserta, Nama Lengkap, Kelas / Rombel.'
        );
        setRows([]);
        return;
      }

      setRows(normalized);
    } catch {
      setError('Gagal membaca file Excel/CSV. Pastikan format file benar.');
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await apiFetch<{
        inserted: number;
        skipped: number;
        duplicates: string[];
      }>('/api/admin/participants/import', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ rows, skip_duplicates: true }),
      });
      setResultMsg(
        `Berhasil mengimpor ${res.inserted} peserta baru. ${
          res.skipped > 0
            ? `${res.skipped} duplikat dilewati (${res.duplicates.slice(0, 5).join(', ')}).`
            : ''
        }`
      );
      onImported();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengimpor data peserta.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Import Massal Peserta (.xlsx / .csv)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                1. Unduh Template Excel Resmi
              </p>
              <p className="mt-0.5">
                Gunakan format kolom standar agar validasi nomor peserta akurat.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadParticipantTemplateExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center hover:border-blue-500 transition-colors">
            <Upload className="h-7 w-7 text-slate-400" />
            <span className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {fileName || 'Pilih file .xlsx atau .csv untuk diunggah'}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Nomor peserta yang sudah terdaftar akan otomatis dideteksi sebagai duplikat.
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
          </label>

          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/60 px-4 py-3 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          {resultMsg && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
              {resultMsg}
            </div>
          )}

          {rows.length > 0 && (
            <div className="max-h-52 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-semibold">No. Peserta</th>
                    <th className="px-3 py-2 font-semibold">Nama Lengkap</th>
                    <th className="px-3 py-2 font-semibold">Kelas</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{r.exam_number}</td>
                      <td className="px-3 py-2">{r.full_name}</td>
                      <td className="px-3 py-2">{r.class_name}</td>
                      <td className="px-3 py-2">{r.is_active ? 'Aktif' : 'Nonaktif'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[11px] text-slate-500">
                  Menampilkan 20 dari {rows.length} baris siap impor.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={rows.length === 0 || importing}
            onClick={handleImport}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {importing ? 'Mengimpor...' : `Impor ${rows.length} Peserta`}
          </button>
        </div>
      </div>
    </div>
  );
};
