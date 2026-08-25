'use client';

// SPA-переходы для Яндекс.Метрики: App Router меняет страницы без перезагрузки,
// и init-хит считает только ПЕРВУЮ загрузку — без этого компонента Метрика
// видела одну страницу за весь сеанс, глубина/поведение были фикцией.
// Шлём hit в оба счётчика (см. layout.tsx).

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const COUNTERS = [111857547, 107768196];

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

function HitsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Первую отрисовку пропускаем: её уже посчитал init (url в опциях)
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (typeof window.ym !== 'function') return;
    const url = window.location.href;
    for (const id of COUNTERS) {
      try {
        window.ym(id, 'hit', url, { referer: document.referrer });
      } catch {}
    }
    // searchParams в зависимостях: смена только query (?tab=...) — тоже переход
  }, [pathname, searchParams]);

  return null;
}

// useSearchParams требует Suspense-границу при пререндере
export default function MetrikaHits() {
  return (
    <Suspense fallback={null}>
      <HitsInner />
    </Suspense>
  );
}
