'use client';

// Проактивный опт-ин в push-напоминания: плоская дисмиссируемая плашка в стиле
// <StreakChip>. Единственная точка входа в подписку раньше была спрятана в
// настройках профиля — почти никто не подписывался. Баннер показывается на главной
// (родитель вшивает сам), сам решает, когда уместен, и запоминает отказ в localStorage.
//
// Показываем только когда: push уместен, пользователь ещё не подписан, не закрывал
// баннер и разрешение != 'denied'. На iOS во вкладке Safari Push недоступен вне
// установленной PWA — там вместо кнопки подсказка «добавь на экран Домой».

import { useEffect, useState } from 'react';
import { X, Bell, Share } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const DISMISS_KEY = 'push_optin_dismissed';

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ маскируется под Mac — ловим по числу тач-точек.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

const SURFACE = {
  background: '#101530',
  border: '1px solid rgba(255,255,255,0.06)',
} as const;

export default function PushOptInBanner() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
  const [mounted, setMounted] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsIOS(detectIOS());
    setIsStandalone(detectStandalone());
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // localStorage может быть недоступен — просто не считаем баннер закрытым.
    }
  }, []);

  // Первичная проверка подписки завершилась — можно показывать баннер без мигания.
  useEffect(() => {
    if (!isLoading) setCheckedOnce(true);
  }, [isLoading]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Игнорируем — в приватном режиме запись может упасть.
    }
  };

  // До монтирования (SSR/гидрация), после закрытия, при активной подписке или
  // жёстком запрете — ничего не рендерим.
  if (!mounted || dismissed || isSubscribed || permission === 'denied') return null;

  // iOS во вкладке Safari: PushManager отсутствует вне standalone-PWA.
  if (!isSupported) {
    if (isIOS && !isStandalone) {
      return (
        <section className="px-4" style={{ paddingTop: 12 }}>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={SURFACE}>
            <Share size={18} className="shrink-0 text-[#A1FF4A]" aria-hidden />
            <span className="text-white text-sm font-medium font-overpass flex-1 min-w-0">
              Добавь Треньки на экран «Домой», чтобы включить напоминания
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Скрыть"
              className="shrink-0 text-white/40 hover:text-white/70 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </section>
      );
    }
    // Не поддерживается по иным причинам (старый десктоп-браузер) — баннер неуместен.
    return null;
  }

  // Ждём завершения первичной проверки подписки, чтобы не мигнуть баннером.
  if (!checkedOnce) return null;

  return (
    <section className="px-4" style={{ paddingTop: 12 }}>
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={SURFACE}>
        <Bell size={18} className="shrink-0 text-[#A1FF4A]" aria-hidden />
        <span className="text-white text-sm font-medium font-overpass flex-1 min-w-0">
          Включи напоминания о тренировках
        </span>
        <button
          type="button"
          // subscribe() дёргает Notification.requestPermission() — вызов обязан
          // остаться внутри пользовательского клика, поэтому зовём его напрямую.
          onClick={() => { void subscribe(); }}
          disabled={isLoading}
          className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold font-overpass text-black transition-opacity disabled:opacity-50"
          style={{ background: '#A1FF4A' }}
        >
          {isLoading ? '…' : 'Включить'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть"
          className="shrink-0 text-white/40 hover:text-white/70 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </section>
  );
}
