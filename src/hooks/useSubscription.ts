'use client';

import { useEffect, useState } from 'react';

// Статус подписки/paywall текущего юзера (из /api/users/me). Общий кэш на модуль,
// чтобы островок, потенциал, баннер и модалка не дёргали /me по отдельности.
// invalidateSubscription() — сбросить (напр. после смены режима/выдачи премиума).

export interface SubscriptionStatus {
  hasPremium: boolean;
  paywalled: boolean; // нужно ли показывать paywall ЭТОМУ юзеру (с учётом режима обкатки)
  paywallActive: boolean; // включён ли paywall в принципе (mode != off) — для premium-UI
  premiumUntil: string | null;
  isAdmin: boolean;
  referralCode: string | null;
}

type Snapshot = SubscriptionStatus & { loading: boolean; loaded: boolean };

const EMPTY: SubscriptionStatus = {
  hasPremium: false,
  paywalled: false,
  paywallActive: false,
  premiumUntil: null,
  isAdmin: false,
  referralCode: null,
};

let cache: SubscriptionStatus | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function fetchStatus(): Promise<void> {
  try {
    const res = await fetch('/api/users/me', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) {
      cache = { ...EMPTY }; // не залогинен / ошибка — считаем без paywall, без премиума
      return;
    }
    const d = await res.json();
    cache = {
      hasPremium: Boolean(d.hasPremium),
      paywalled: Boolean(d.paywalled),
      paywallActive: Boolean(d.paywallActive),
      premiumUntil: d.premiumUntil ?? null,
      isAdmin: Boolean(d.isAdmin),
      referralCode: d.referralCode ?? null,
    };
  } catch {
    cache = { ...EMPTY };
  } finally {
    notify();
  }
}

function ensureLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!inflight) {
    inflight = fetchStatus().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Сбросить кэш и перезагрузить (все подписчики перерисуются). */
export function invalidateSubscription() {
  cache = null;
  ensureLoaded();
}

export function useSubscription(): Snapshot {
  const [, setTick] = useState(0);

  useEffect(() => {
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);
    ensureLoaded();
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  if (!cache) {
    return { ...EMPTY, loading: true, loaded: false };
  }
  return { ...cache, loading: false, loaded: true };
}
