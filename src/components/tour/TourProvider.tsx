'use client';

// Глобальный провайдер продуктового тура. Монтируется один раз в
// OnboardingWrapper (в layout, выше BottomNavigation), поэтому переживает
// смену маршрутов: при переходе на другой экран страница перемонтируется,
// а состояние тура живёт здесь.
//
// Ключевые механики:
//   - текущий шаг (его id) в sessionStorage (переживает рефреш/редирект).
//     Именно id, а не номер: без подписки платные шаги выпадают из списка
//     (статус подписки может догрузиться уже во время тура), и номер съехал бы
//   - при шаге с navigate:'wait' на другом маршруте — ждём, пока приложение
//     само туда перейдёт (сборка недели), с таймаутом на случай ошибки
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
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { availableTourSteps } from './product-tour';
import { useSubscription } from '@/hooks/useSubscription';
import { waitForElement } from '@/lib/waitForElement';
import TourOverlay from './TourOverlay';

const COMPLETED_KEY = 'trenki_tour_completed';
const STEP_KEY = 'trenki_tour_step';
/** Сколько ждать перехода, который должно сделать приложение (navigate:'wait'),
 *  прежде чем перейти самим: сборка недели занимает до ~15 с, а при её ошибке
 *  тур иначе висел бы невидимым. */
const WAIT_ROUTE_TIMEOUT_MS = 30_000;

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

  const { paywalled } = useSubscription();
  const steps = useMemo(() => availableTourSteps(paywalled), [paywalled]);

  const [active, setActive] = useState(false);
  const [stepId, setStepId] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false); // overlay показываем только когда цель определена
  const elRef = useRef<HTMLElement | null>(null);

  const stepIndex = stepId ? steps.findIndex((s) => s.id === stepId) : -1;
  const step = active && stepIndex >= 0 ? steps[stepIndex] : null;

  // Восстановление после рефреша/редиректа посреди тура. Старый формат
  // (номер шага) и неизвестный id не восстанавливаем — тур начнётся заново
  // с кнопки.
  useEffect(() => {
    const saved = sessionStorage.getItem(STEP_KEY);
    if (saved !== null && availableTourSteps(false).some((s) => s.id === saved)) {
      setStepId(saved);
      setActive(true);
    } else if (saved !== null) {
      sessionStorage.removeItem(STEP_KEY);
    }
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, '1');
      sessionStorage.removeItem(STEP_KEY);
    } catch {}
    setActive(false);
    setStepId(null);
    setRect(null);
    setReady(false);
    elRef.current = null;
  }, []);

  const goTo = useCallback((id: string) => {
    try {
      sessionStorage.setItem(STEP_KEY, id);
    } catch {}
    setRect(null);
    setReady(false);
    elRef.current = null;
    setStepId(id);
  }, []);

  const startTour = useCallback(() => {
    goTo(steps[0].id);
    setActive(true);
  }, [goTo, steps]);

  const advance = useCallback(() => {
    const next = steps[stepIndex + 1];
    if (!next) {
      finish();
      return;
    }
    goTo(next.id);
  }, [steps, stepIndex, goTo, finish]);

  // Сохранённый шаг выпал из списка (статус подписки догрузился: платный шаг
  // недоступен) — переходим к следующему доступному по порядку сценария.
  useEffect(() => {
    if (!active || !stepId || stepIndex >= 0) return;
    const all = availableTourSteps(false);
    const pos = all.findIndex((s) => s.id === stepId);
    const next = all.slice(pos + 1).find((s) => steps.some((x) => x.id === s.id));
    if (next) goTo(next.id);
    else finish();
  }, [active, stepId, stepIndex, steps, goTo, finish]);

  // Резолв цели текущего шага: навигация (если нужно) + ожидание элемента.
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;

    if (pathname !== step.route) {
      if (step.navigate === 'wait') {
        // Переход сделает само приложение (сборка недели → календарь).
        // Подсказку не показываем; если перехода так и нет — идём сами.
        const timer = setTimeout(() => router.push(step.route), WAIT_ROUTE_TIMEOUT_MS);
        return () => clearTimeout(timer);
      }
      router.push(step.route);
      // дождёмся смены pathname — эффект перезапустится
      return;
    }

    (async () => {
      // 16с таймаута: на шаге микроцикла баннер появляется только после
      // генерации (5 тренировок последовательно) + refetch — это может занять
      // 10-15с. На остальных шагах элемент находится мгновенно.
      const el = await waitForElement(`[data-tour="${step.anchor}"]`, 16000);
      if (cancelled) return;
      if (el) {
        elRef.current = el;
        // Высокие цели (напр. длинный список целей) центрировать нельзя —
        // тултипу не остаётся места и он перекрывает спотлайт. Прижимаем такую
        // цель к верху (чуть ниже сейфзоны), тогда тултип уходит вниз без
        // перекрытия. Обычные (невысокие) цели центрируем как раньше.
        const vhNow = window.innerHeight;
        const hNow = el.getBoundingClientRect().height;
        if (hNow > vhNow * 0.5) {
          const SAFE_TOP = 64; // прибл. env(safe-area-inset-top) + отступ
          const curTop = el.getBoundingClientRect().top;
          window.scrollBy({ top: curTop - SAFE_TOP, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        // даём скроллу осесть, затем меряем
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setReady(true);
        }, 380);
      } else if (step.optional) {
        // Цели нет по уважительной причине (напр. неделя не собралась) —
        // подсказка про несуществующее только запутает, идём дальше.
        advance();
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
  }, [active, stepId, pathname]);

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
  }, [active, ready, stepId, step, advance]);

  return (
    <TourContext.Provider value={{ startTour, stopTour: finish, isActive: active }}>
      {children}
      {active && step && ready && (
        <TourOverlay
          step={step}
          rect={rect}
          index={stepIndex}
          total={steps.length}
          onNext={advance}
          onSkip={finish}
        />
      )}
    </TourContext.Provider>
  );
}
