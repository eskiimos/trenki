'use client';

// Глобальный провайдер продуктового тура. Монтируется один раз в
// OnboardingWrapper (в layout, выше BottomNavigation), поэтому переживает
// смену маршрутов: при переходе на другой экран страница перемонтируется,
// а состояние тура живёт здесь.
//
// Ключевые механики:
//   - текущий шаг в sessionStorage (переживает рефреш/редирект)
//   - факт прохождения в localStorage (пока не используем для автозапуска —
//     запуск только по кнопке из /profile, как договорились)
//   - при шаге на другом маршруте: router.push → waitForElement → spotlight
//   - advanceOn:'tap' — capture-слушатель на целевом элементе: реальный
//     клик пользователя продвигает тур И выполняется (переход/выбор/генерация)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PRODUCT_TOUR } from './product-tour';
import { waitForElement } from '@/lib/waitForElement';
import TourOverlay from './TourOverlay';

const COMPLETED_KEY = 'trenki_tour_completed';
const STEP_KEY = 'trenki_tour_step';

interface TourContextValue {
  startTour: () => void;
  stopTour: () => void;
  isActive: boolean;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  stopTour: () => {},
  isActive: false,
});

export const useTour = () => useContext(TourContext);

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false); // overlay показываем только когда цель определена
  const elRef = useRef<HTMLElement | null>(null);

  const step = active ? PRODUCT_TOUR[stepIndex] : null;

  // Восстановление после рефреша/редиректа посреди тура.
  useEffect(() => {
    const saved = sessionStorage.getItem(STEP_KEY);
    if (saved !== null) {
      const idx = Number(saved);
      if (!Number.isNaN(idx) && idx >= 0 && idx < PRODUCT_TOUR.length) {
        setStepIndex(idx);
        setActive(true);
      }
    }
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, '1');
      sessionStorage.removeItem(STEP_KEY);
    } catch {}
    setActive(false);
    setStepIndex(0);
    setRect(null);
    setReady(false);
    elRef.current = null;
  }, []);

  const startTour = useCallback(() => {
    try {
      sessionStorage.setItem(STEP_KEY, '0');
    } catch {}
    setRect(null);
    setReady(false);
    setStepIndex(0);
    setActive(true);
  }, []);

  const advance = useCallback(() => {
    setReady(false);
    setRect(null);
    elRef.current = null;
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= PRODUCT_TOUR.length) {
        finish();
        return i;
      }
      try {
        sessionStorage.setItem(STEP_KEY, String(next));
      } catch {}
      return next;
    });
  }, [finish]);

  // Резолв цели текущего шага: навигация (если нужно) + ожидание элемента.
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;

    if (pathname !== step.route) {
      router.push(step.route);
      // дождёмся смены pathname — эффект перезапустится
      return;
    }

    (async () => {
      const el = await waitForElement(`[data-tour="${step.anchor}"]`, 8000);
      if (cancelled) return;
      if (el) {
        elRef.current = el;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // даём скроллу осесть, затем меряем
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setReady(true);
        }, 380);
      } else {
        // не нашли — центрированный фолбэк (пустые состояния и т.п.)
        elRef.current = null;
        setRect(null);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, pathname]);

  // Перемер позиции при скролле/resize, пока цель видна.
  useEffect(() => {
    if (!active || !ready || !elRef.current) return;
    const update = () => {
      const el = elRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, ready]);

  // Для шагов advanceOn:'tap' — ловим реальный клик по цели (capture),
  // НЕ отменяя его: пусть выполнится переход/выбор/генерация.
  useEffect(() => {
    if (!active || !ready || !step || step.advanceOn !== 'tap') return;
    const el = elRef.current;
    if (!el) return;
    const handler = () => {
      advance();
    };
    el.addEventListener('click', handler, { capture: true, once: true });
    return () => {
      el.removeEventListener('click', handler, { capture: true } as EventListenerOptions);
    };
  }, [active, ready, stepIndex, step, advance]);

  return (
    <TourContext.Provider value={{ startTour, stopTour: finish, isActive: active }}>
      {children}
      {active && step && ready && (
        <TourOverlay
          step={step}
          rect={rect}
          index={stepIndex}
          total={PRODUCT_TOUR.length}
          onNext={advance}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
