'use client';

import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import {
  isStandalone,
  isIOSSafari,
  getDeferredPrompt,
  subscribeDeferredPrompt,
  promptInstall,
} from '@/lib/platform';
import {
  subscribeBanners,
  highestActivePriority,
  BANNER_PRIORITY,
} from '@/lib/bottom-banner-registry';

// Пилюля «добавь на экран Домой». Показывается только на главной, ОДИН раз на
// устройство (localStorage), с задержкой ~5 секунд после маунта:
// - Android/Chromium: beforeinstallprompt перехватывается в src/lib/platform.ts
//   (preventDefault + stash при импорте модуля) → кнопка «Установить» зовёт
//   нативный prompt(); accepted/dismissed — в любом случае прячем и помечаем;
// - iOS Safari (нативного API у Apple нет): текстовая инструкция
//   «Поделиться → На экран „Домой“»;
// - standalone / прочие браузеры и вебвью — молчим.

const SEEN_KEY = 'trenki_a2hs_seen'; // один показ на устройство
const SHOW_DELAY_MS = 5000;

type Mode = 'android' | 'ios';

export default function AddToHomeScreen() {
  const [mode, setMode] = useState<Mode | null>(null);
  // Уступаем более важным нижним баннерам (напр. напоминанию о тренировке),
  // чтобы не налезать друг на друга.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const check = () => setBlocked(highestActivePriority('install') > BANNER_PRIORITY.install);
    check();
    return subscribeBanners(check);
  }, []);

  useEffect(() => {
    if (isStandalone()) return; // уже установлено (display-mode / navigator.standalone)

    // Один раз на устройство
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* localStorage недоступен — покажем */
    }

    let delayed = false;
    const decide = () => {
      if (!delayed) return;
      if (getDeferredPrompt()) setMode('android');
      else if (isIOSSafari()) setMode('ios');
      else setMode(null); // напр. appinstalled сбросил prompt — прячем
    };

    const timer = setTimeout(() => {
      delayed = true;
      decide();
    }, SHOW_DELAY_MS);

    // beforeinstallprompt может прийти позже задержки, appinstalled — спрятать:
    // переоцениваем по событиям из platform.ts.
    const unsub = subscribeDeferredPrompt(decide);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setMode(null);
  };

  const install = async () => {
    await promptInstall(); // accepted или dismissed — дальше не пристаём
    close();
  };

  if (!mode || blocked) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
    >
      <div className="max-w-md mx-auto pointer-events-auto animate-slideUp rounded-2xl bg-[#101530] border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.45)] p-3.5 flex items-center gap-3">
        {mode === 'ios' && (
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
            <Share size={20} className="text-[#A1FF4A]" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="font-overpass font-extrabold text-sm text-[#F9F8FE]">
            Установи Треньки на телефон
          </div>
          <div className="text-xs text-[#AEABBB] mt-0.5 leading-snug">
            {mode === 'ios'
              ? 'Нажми «Поделиться» и выбери «На экран Домой»'
              : 'Быстрый доступ с экрана «Домой», без магазина'}
          </div>
        </div>

        <button
          type="button"
          onClick={mode === 'android' ? install : close}
          className="flex-shrink-0 bg-[#A1FF4A] text-[#060919] rounded-full px-3.5 py-2 text-xs font-overpass font-black uppercase transition-transform active:scale-95"
        >
          {mode === 'android' ? 'Установить' : 'Понятно'}
        </button>

        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="flex-shrink-0 text-[#AEABBB] p-0.5 transition-colors hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
