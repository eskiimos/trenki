'use client';

// Анимированное число (XP, очки): бежит от prev к value с ease-out. Часть кита
// анимаций (/admin/animation-kit). При prefers-reduced-motion показывает
// значение сразу — без бега.

import { useEffect, useRef, useState } from 'react';

export default function CountUp({
  value,
  durationMs = 600,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{shown}</span>;
}
