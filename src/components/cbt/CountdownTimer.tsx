import { AlertTriangle, Clock } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface CountdownTimerProps {
  endTimeIso: string;
  serverOffsetMs: number;
  onExpire: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  endTimeIso,
  serverOffsetMs,
  onExpire,
}) => {
  const expiredRef = useRef(false);

  const computeRemainingSeconds = () => {
    const endMs = Date.parse(endTimeIso);
    const serverNowMs = Date.now() + serverOffsetMs;
    return Math.max(0, Math.floor((endMs - serverNowMs) / 1000));
  };

  const [remainingSec, setRemainingSec] = useState<number>(computeRemainingSeconds);

  useEffect(() => {
    expiredRef.current = false;
    setRemainingSec(computeRemainingSeconds());

    const interval = window.setInterval(() => {
      const next = computeRemainingSeconds();
      setRemainingSec(next);
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        window.clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTimeIso, serverOffsetMs]);

  const hours = Math.floor(remainingSec / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const isCritical = remainingSec <= 300; // < 5 menit

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors ${
        isCritical
          ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          : 'border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
      }`}
      role="timer"
      aria-live="polite"
      aria-label={`Sisa waktu ujian ${pad(hours)} jam ${pad(minutes)} menit ${pad(seconds)} detik`}
    >
      {isCritical ? (
        <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
      ) : (
        <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
      )}
      <span>
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
      {isCritical && (
        <span className="text-[11px] font-sans font-semibold uppercase tracking-wide">
          Waktu Hampir Habis
        </span>
      )}
    </div>
  );
};
