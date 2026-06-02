'use client';

import { useEffect } from 'react';

/**
 * Регистрирует Service Worker для PWA и слушает controllerchange,
 * чтобы перезагружать страницу после обновления SW.
 *
 * Обработка beforeinstallprompt вынесена в <InstallPWAButton />, чтобы
 * не дублировать listener.
 */
export default function PWAInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        // Проверка обновлений каждый час
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });

    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
