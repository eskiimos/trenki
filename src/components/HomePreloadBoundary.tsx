'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import AppLoader from '@/components/AppLoader';

const SECTIONS = ['auth', 'policy', 'guide', 'subscription', 'header', 'shorts', 'schedule', 'tasks', 'cycle', 'workout', 'trainers', 'videos', 'streak', 'checkin', 'push'] as const;
type HomeSection = typeof SECTIONS[number];
const HomePreloadContext = createContext<((section: HomeSection, failed: boolean) => void) | null>(null);

/** Outside the home preloader this is a no-op; shared cards keep their behavior. */
export function useHomeSectionReady(section: HomeSection, ready: boolean, failed = false) {
  const settle = useContext(HomePreloadContext);
  useEffect(() => {
    if (ready) settle?.(section, failed);
  }, [settle, section, ready, failed]);
}

export default function HomePreloadBoundary({ children }: { children: ReactNode }) {
  const [settled, setSettled] = useState<Set<HomeSection>>(() => new Set());
  const settledRef = useRef(new Set<HomeSection>());
  const [failed, setFailed] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const settle = useCallback((section: HomeSection, hasError: boolean) => {
    // Only the first result belongs to initial preloading. Later refocus or
    // subscription refresh failures must not insert a new banner above a page
    // the athlete is already using.
    if (settledRef.current.has(section)) return;
    settledRef.current.add(section);
    setSettled(new Set(settledRef.current));
    if (hasError) setFailed(true);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const finishFonts = () => { if (!cancelled) setFontsReady(true); };
    Promise.resolve(document.fonts?.ready).then(finishFonts, finishFonts);
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  const ready = fontsReady && SECTIONS.every((section) => settled.has(section));

  return (
    <HomePreloadContext.Provider value={settle}>
      <AppLoader ready={ready} />
      {!ready && slow && (
        <div role="status" className="fixed inset-x-4 bottom-10 z-[10000] rounded-xl bg-[#101530] p-4 text-center text-sm text-white">
          Загрузка занимает больше времени. Проверь соединение и попробуй ещё раз.
          <button type="button" className="mt-3 block w-full rounded-full bg-[#A1FF4A] px-4 py-3 font-bold text-[#060919]" onClick={() => window.location.reload()}>Обновить страницу</button>
        </div>
      )}
      <div data-home-ready={ready ? 'true' : 'false'} data-home-pending={SECTIONS.filter((section) => !settled.has(section)).join(',')} aria-busy={!ready} aria-hidden={!ready || undefined} inert={!ready} style={{ visibility: ready ? 'visible' : 'hidden', height: ready ? undefined : '100dvh', overflow: ready ? undefined : 'hidden' }}>
        {ready && failed && (
          <div role="status" className="bg-[#101530] px-4 py-3 text-center text-sm text-white">
            Часть данных не загрузилась. <button type="button" className="text-[#A1FF4A] underline" onClick={() => window.location.reload()}>Обновить</button>
          </div>
        )}
        {children}
      </div>
    </HomePreloadContext.Provider>
  );
}
