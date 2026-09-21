import { describe, it, expect } from 'vitest';
import { PRODUCT_TOUR, availableTourSteps } from '../../src/components/tour/product-tour';

describe('продуктовый тур', () => {
  it('id шагов уникальны (текущий шаг хранится по id)', () => {
    const ids = PRODUCT_TOUR.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ровно один последний шаг, и он в конце', () => {
    expect(PRODUCT_TOUR.filter((s) => s.isLast)).toHaveLength(1);
    expect(PRODUCT_TOUR[PRODUCT_TOUR.length - 1].isLast).toBe(true);
  });

  it('без подписки шаги про неделю пропускаются, порядок остальных сохраняется', () => {
    const all = availableTourSteps(false).map((s) => s.id);
    const paywalled = availableTourSteps(true).map((s) => s.id);
    expect(all).toContain('home-week');
    expect(paywalled).not.toContain('home-week');
    expect(paywalled).not.toContain('cal-week');
    expect(paywalled).toEqual(all.filter((id) => id !== 'home-week' && id !== 'cal-week'));
    expect(availableTourSteps(true).at(-1)?.isLast).toBe(true);
  });

  it('шаг, ждущий перехода приложения, идёт сразу после тапа, который этот переход делает', () => {
    PRODUCT_TOUR.forEach((step, i) => {
      if (step.navigate === 'wait') expect(PRODUCT_TOUR[i - 1]?.advanceOn).toBe('tap');
    });
  });
});
