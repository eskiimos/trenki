import { describe, it, expect } from 'vitest';
import {
  columnCenter,
  columnWidth,
  placeColumnLabels,
  type ColumnGeometry,
  type LabelCandidate,
  type PlacedLabel,
} from '@/lib/stats/bar-labels';

const metrics = { charWidth: 6, padding: 1, minSpacing: 2 };
const values = (vals: number[]): LabelCandidate[] =>
  vals.flatMap((v, index) => (v > 0 ? [{ index, text: String(v), priority: v }] : []));

function expectNoOverlap(placed: PlacedLabel[], spacing = metrics.minSpacing) {
  const sorted = [...placed].sort((a, b) => a.left - b.left);
  for (let i = 1; i < sorted.length; i += 1) {
    expect(sorted[i].left).toBeGreaterThanOrEqual(sorted[i - 1].left + sorted[i - 1].width + spacing - 1e-9);
  }
}

describe('геометрия колонок совпадает с CSS-гридом', () => {
  it('ширина и центр', () => {
    const g: ColumnGeometry = { count: 30, width: 318, gap: 2 };
    expect(columnWidth(g)).toBeCloseTo(8.667, 2);
    expect(columnCenter(g, 0)).toBeCloseTo(4.333, 2);
    // правый край последней колонки = ширина графика
    expect(columnCenter(g, 29) + columnWidth(g) / 2).toBeCloseTo(318, 6);
  });
});

describe('placeColumnLabels', () => {
  it('на широком графике подписаны все ненулевые столбики', () => {
    const vals = Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? 0 : 10 + i));
    const placed = placeColumnLabels(values(vals), { count: 30, width: 1100, gap: 2 }, metrics);
    expect(placed.map((p) => p.index)).toEqual(vals.flatMap((v, i) => (v > 0 ? [i] : [])));
  });

  it('нули не подписываются (их нет среди кандидатов)', () => {
    const placed = placeColumnLabels(values([0, 0, 5, 0]), { count: 4, width: 200, gap: 2 }, metrics);
    expect(placed).toEqual([expect.objectContaining({ index: 2, text: '5' })]);
  });

  it('телефон 320px: двузначные подписи не налезают, пик всегда подписан', () => {
    const vals = Array.from({ length: 30 }, (_, i) => 10 + ((i * 7) % 23));
    const g = { count: 30, width: 256, gap: 2 };
    const placed = placeColumnLabels(values(vals), g, metrics);
    expectNoOverlap(placed);
    const peak = vals.indexOf(Math.max(...vals));
    expect(placed.some((p) => p.index === peak)).toBe(true);
    // часть подписей пропущена — иначе они бы наложились
    expect(placed.length).toBeLessThan(30);
    expect(placed.length).toBeGreaterThan(5);
    for (const p of placed) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left + p.width).toBeLessThanOrEqual(g.width + 1e-9);
    }
  });

  it('крайние подписи прижимаются к краям, а не вылезают за график', () => {
    const g = { count: 30, width: 256, gap: 2 };
    const vals = Array.from({ length: 30 }, () => 0);
    vals[0] = 123;
    vals[29] = 456;
    const placed = placeColumnLabels(values(vals), g, metrics);
    expect(placed[0].left).toBe(0);
    expect(placed[1].left + placed[1].width).toBeCloseTo(256, 9);
  });

  it('при столкновении побеждает большее значение, при равенстве — более свежий день', () => {
    const g = { count: 30, width: 256, gap: 2 };
    const bigger = placeColumnLabels(values([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 40]), g, metrics);
    expect(bigger.map((p) => p.index)).toEqual([11]);
    const tie = placeColumnLabels(values([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 25]), g, metrics);
    expect(tie.map((p) => p.index)).toEqual([11]);
  });

  it('число не налезает на соседний более высокий столбик', () => {
    const n = 30;
    const vals = Array.from({ length: n }, () => 0);
    vals[10] = 20;
    vals[11] = 40;
    const heights = vals.map((v) => v * 2.5); // 40 → 100px, 20 → 50px
    const g = { count: n, width: 256, gap: 2, barHeights: heights };
    const cands = vals.flatMap((v, index) =>
      v > 0 ? [{ index, text: String(v), priority: v, bottom: heights[index] + 2 }] : [],
    );
    // Подписи разнесены по вертикали (52 и 102px) и друг другу не мешают,
    // но «20» по ширине заходит на столбик «40», который выше её
    expect(placeColumnLabels(cands, g, metrics).map((p) => p.index)).toEqual([11]);
    // На широком графике «20» умещается над своей колонкой
    expect(placeColumnLabels(cands, { ...g, width: 1100 }, metrics).map((p) => p.index)).toEqual([10, 11]);
  });

  it('подписи на разной высоте не мешают друг другу, если не задевают чужие столбики', () => {
    const n = 30;
    const vals = Array.from({ length: n }, () => 0);
    vals[10] = 40;
    vals[11] = 3;
    const heights = vals.map((v) => v * 2.5); // 100px и 7.5px
    const g = { count: n, width: 318, gap: 2, barHeights: heights };
    const cands = vals.flatMap((v, index) =>
      v > 0 ? [{ index, text: String(v), priority: v, bottom: heights[index] + 2 }] : [],
    );
    const placed = placeColumnLabels(cands, g, { ...metrics, lineHeight: 12 });
    expect(placed.map((p) => p.index)).toEqual([10, 11]);
    expect(placed[0].bottom).toBe(102);
    expect(placed[1].bottom).toBe(9.5);
  });

  it('вырожденные случаи', () => {
    expect(placeColumnLabels(values([1, 2]), { count: 2, width: 0, gap: 2 }, metrics)).toEqual([]);
    expect(placeColumnLabels([], { count: 30, width: 300, gap: 2 }, metrics)).toEqual([]);
    // подпись шире всего графика не ставится
    expect(placeColumnLabels([{ index: 0, text: '1234567890', priority: 1 }], { count: 1, width: 20, gap: 0 }, metrics)).toEqual([]);
    // индекс вне ряда игнорируется
    expect(placeColumnLabels([{ index: 5, text: '1', priority: 1 }], { count: 3, width: 300, gap: 2 }, metrics)).toEqual([]);
  });
});
