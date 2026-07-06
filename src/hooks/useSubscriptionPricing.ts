'use client';

import { useEffect, useState } from 'react';
import { PRICING_DEFAULTS, computeIntroPrice, type SubscriptionPricing } from '@/lib/subscription-plan';

// Цены подписки из /api/subscription/pricing (редактируются в админке). Кэш на модуль.
// До загрузки отдаёт дефолты, чтобы не мигать пустотой.

const DEFAULT: SubscriptionPricing = {
  priceMonthlyRub: PRICING_DEFAULTS.priceMonthlyRub,
  introDiscountPercent: PRICING_DEFAULTS.introDiscountPercent,
  introMonths: PRICING_DEFAULTS.introMonths,
  introPriceRub: computeIntroPrice(PRICING_DEFAULTS.priceMonthlyRub, PRICING_DEFAULTS.introDiscountPercent),
};

let cache: SubscriptionPricing | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<void> {
  try {
    const res = await fetch('/api/subscription/pricing', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      cache = {
        priceMonthlyRub: Number(d.priceMonthlyRub) || DEFAULT.priceMonthlyRub,
        introDiscountPercent: Number(d.introDiscountPercent) ?? DEFAULT.introDiscountPercent,
        introMonths: Number(d.introMonths) ?? DEFAULT.introMonths,
        introPriceRub: Number(d.introPriceRub) || DEFAULT.introPriceRub,
      };
    } else {
      cache = { ...DEFAULT };
    }
  } catch {
    cache = { ...DEFAULT };
  } finally {
    listeners.forEach((l) => l());
  }
}

function ensureLoaded(): Promise<void> {
  if (cache) return Promise.resolve();
  if (!inflight) inflight = load().finally(() => (inflight = null));
  return inflight;
}

export function useSubscriptionPricing(): SubscriptionPricing {
  const [, setTick] = useState(0);
  useEffect(() => {
    const rerender = () => setTick((t) => t + 1);
    listeners.add(rerender);
    ensureLoaded();
    return () => {
      listeners.delete(rerender);
    };
  }, []);
  return cache ?? DEFAULT;
}
