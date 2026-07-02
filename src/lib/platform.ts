'use client';

// Детект среды для баннера установки PWA (клиент-only, эвристика по UA + API).

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      // iOS Safari — нестандартный флаг
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      // Android TWA
      document.referrer.startsWith('android-app://')
    );
  } catch {
    return false;
  }
}

const IOS_RE = /iPhone|iPad|iPod/i;
// Встроенные вебвью, где установка на «Домой» недоступна.
const INAPP_RE = /Instagram|FBAN|FBAV|FB_IAB|VKClient|VKAndroidApp|OKApp|Line\//i;
// iOS-браузеры НЕ Safari (у них тоже нет установки, но подсказку про «Поделиться» не даём).
const IOS_NON_SAFARI_RE = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/i;

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS ≥13 маскируется под Mac → ловим по тач-точкам.
  return (
    IOS_RE.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1)
  );
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return INAPP_RE.test(navigator.userAgent || '');
}

export function isIOSSafari(): boolean {
  return isIOS() && !IOS_NON_SAFARI_RE.test(navigator.userAgent || '');
}

// ── Захват beforeinstallprompt (Android/Chromium). Слушатель ставим при импорте
// модуля, чтобы поймать событие максимально рано (оно приходит вскоре после
// загрузки). Компоненты подписываются на изменения. ──
type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BIPEvent | null = null;
const subs = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    subs.forEach((cb) => cb());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    subs.forEach((cb) => cb());
  });
}

export function getDeferredPrompt(): BIPEvent | null {
  return deferredPrompt;
}

export function subscribeDeferredPrompt(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

/** Показать нативный промпт установки (Android). true — если пользователь согласился. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    subs.forEach((cb) => cb());
    return choice?.outcome === 'accepted';
  } catch {
    return false;
  }
}
