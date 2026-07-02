'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  isStandalone,
  isIOSSafari,
  isInAppBrowser,
  getDeferredPrompt,
  subscribeDeferredPrompt,
  promptInstall,
} from '@/lib/platform';

// Баннер «установить на экран Домой». Показывается ТОЛЬКО на главной, адаптивно:
// - Android/Chromium (есть beforeinstallprompt) → кнопка нативной установки;
// - iOS Safari → подсказка «Поделиться → На экран „Домой“» (нативной установки у Apple нет);
// - встроенный вебвью (Instagram/VK/TG) → «открой в Safari/Chrome»;
// - уже установлено / прочее → ничего.
// Закрывается на 7 дней (localStorage).

const DISMISS_KEY = 'install_banner_dismissed_until';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

type Mode = 'android' | 'ios' | 'inapp';

export default function InstallBanner() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    if (isStandalone()) return; // уже в приложении

    // Дисмисс на 7 дней
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() < until) return;
    } catch {
      /* localStorage недоступен — покажем */
    }

    const decide = () => {
      if (getDeferredPrompt()) setMode('android');
      else if (isInAppBrowser()) setMode('inapp'); // вебвью раньше iOS Safari
      else if (isIOSSafari()) setMode('ios');
      // Android до прихода beforeinstallprompt / desktop / iOS-не-Safari — ждём или молчим.
    };
    decide();
    // beforeinstallprompt может прийти чуть позже — переоценим по событию.
    // appinstalled (в т.ч. установка через меню браузера) — прячем баннер.
    const onInstalled = () => setMode(null);
    window.addEventListener('appinstalled', onInstalled);
    const unsub = subscribeDeferredPrompt(decide);
    return () => {
      unsub();
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      /* ignore */
    }
    setMode(null);
  };

  const install = async () => {
    const ok = await promptInstall();
    if (ok) setMode(null);
  };

  if (!mode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(69px + env(safe-area-inset-bottom, 0px) + 8px)', // над нижним меню
        zIndex: 60,
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      <div
        className="max-w-md mx-auto animate-slideUp"
        style={{
          pointerEvents: 'auto',
          background: '#101530',
          border: '1px solid #26252F',
          borderRadius: 16,
          padding: 14,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        }}
      >
        <Image src="/icons/icon-app.svg" alt="" width={40} height={40} style={{ borderRadius: 9, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {mode === 'android' && (
            <>
              <div className="font-overpass" style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 14 }}>
                Установи приложение
              </div>
              <div style={{ color: '#AEABBB', fontSize: 12, marginTop: 2 }}>
                Быстрый доступ с экрана «Домой», без магазина.
              </div>
            </>
          )}
          {mode === 'ios' && (
            <>
              <div className="font-overpass" style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 14 }}>
                Установи на экран «Домой»
              </div>
              <div style={{ color: '#AEABBB', fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>
                Нажми «Поделиться» ⬆️ внизу Safari → «На экран „Домой“».
              </div>
            </>
          )}
          {mode === 'inapp' && (
            <>
              <div className="font-overpass" style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 14 }}>
                Открой в браузере
              </div>
              <div style={{ color: '#AEABBB', fontSize: 12, marginTop: 2, lineHeight: 1.35 }}>
                Чтобы установить, открой trenki.app в Safari или Chrome.
              </div>
            </>
          )}
        </div>

        {mode === 'android' && (
          <button
            type="button"
            onClick={install}
            className="font-overpass uppercase transition-transform active:scale-95"
            style={{
              flexShrink: 0,
              background: '#A1FF4A',
              color: '#060919',
              border: 'none',
              borderRadius: 999,
              padding: '9px 14px',
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Установить
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Закрыть"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: '#AEABBB',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            padding: '0 2px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
