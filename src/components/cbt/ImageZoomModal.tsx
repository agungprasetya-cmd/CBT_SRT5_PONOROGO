import { Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useState } from 'react';

interface ImageZoomModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  src,
  alt = 'Gambar Stimulus Soal',
  onClose,
}) => {
  const [scale, setScale] = useState(1);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pembesar Gambar Soal"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {alt}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.75, +(s - 0.25).toFixed(2)))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Perkecil Gambar"
            >
              <ZoomOut className="h-4 w-4" />
              Perkecil
            </button>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Perbesar Gambar"
            >
              <ZoomIn className="h-4 w-4" />
              Perbesar
            </button>
            <button
              type="button"
              onClick={() => setScale(scale === 1 ? 1.5 : 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {scale === 1 ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 p-6 flex items-center justify-center">
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="max-h-[72vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white object-contain transition-transform duration-150"
          />
        </div>
      </div>
    </div>
  );
};
