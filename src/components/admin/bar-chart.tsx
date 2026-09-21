'use client';

// ─── Столбчатый график админки ─────────────────────────────────────────────
// Один компонент на дашборд (/admin) и аналитику (/admin/stats). Раньше их
// было два: Sparkline на дашборде (без чисел, значение только в title — на
// телефоне не видно) и BarChart в /admin/stats (minWidth = 20px × столбик →
// на телефоне график уезжал вбок, подсказка по hover не работала на касании,
// «1 регистраций»). Здесь:
//   · столбики — CSS-грид repeat(n, minmax(0, 1fr)): всегда влезают в ширину
//     карточки, горизонтального скролла нет ни на 320px, ни на десктопе;
//   · число над столбиком — где помещается без наложения (раскладка в
//     src/lib/stats/bar-labels), остальное — по тапу/наведению в строке сверху;
//   · склонение единиц — через plural.

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LineChart } from 'lucide-react';
import { EmptyState } from '@/components/admin/ui';
import { plural } from '@/lib/plural';
import { placeColumnLabels } from '@/lib/stats/bar-labels';
import { dayLabels, type DailyPoint } from '@/lib/stats/daily-series';

/** Формы единицы для plural: ['регистрация', 'регистрации', 'регистраций']. */
export type UnitForms = [string, string, string];

export interface BarDatum {
  key: string;
  value: number;
  /** Имя столбика в строке выбора: «Пн, 15.09», «14:00–15:00». */
  title: string;
  /**
   * Короткое имя для строки «Пик» (по умолчанию title): там перед именем ещё
   * «Пик: », и полное «Пн, 21.09 (сегодня)» на 320px не оставляло места числу.
   */
  peakTitle?: string;
  /** Подпись под осью; ставится, если хватает места (по axisPriority). */
  axisLabel?: string;
  axisPriority?: number;
}

/** Зазор между столбиками, px. */
const GAP = 2;
/** Столбик не толще 24px: на широком экране остаток колонки — воздух. */
const MAX_BAR_WIDTH = 24;
/** Ненулевой столбик не ниже 3px — иначе «1» на фоне пика «40» не увидеть. */
const MIN_BAR_HEIGHT = 3;
/** Место над самым высоким столбиком под его число. */
const VALUE_LANE = 16;
const VALUE_FONT = 10;
const VALUE_LINE = 12;
/** Зазор между верхом столбика и его числом, px. */
const LABEL_GAP = 2;
const AXIS_FONT = 11;
const AXIS_HEIGHT = 16;
/** Оценки ширины символа (цифры tabular-nums ≈ 0.6 кегля) с запасом. */
const VALUE_CHAR_W = 6.2;
const AXIS_CHAR_W = 6.8;

const fmt = (n: number) => n.toLocaleString('ru-RU');
const withUnit = (n: number, unit: UnitForms) => `${fmt(n)} ${plural(n, unit)}`;

export function BarChart({
  data,
  color,
  unit,
  height = 160,
  label,
}: {
  data: BarDatum[];
  /** Цвет столбиков (токен); текст всегда в текстовых токенах. */
  color: string;
  unit: UnitForms;
  /** Высота области столбиков вместе с местом под числа, px. */
  height?: number;
  /** Доступное имя графика для скринридера. */
  label: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Выбор храним по key, а не по индексу: при автообновлении после полуночи
  // окно сдвигается на день, и индекс указал бы на другой день.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Ширину меряем до отрисовки кадра: от неё зависит, какие подписи влезут.
  const hasData = data.length > 0;
  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  const max = useMemo(() => Math.max(0, ...data.map((d) => d.value)), [data]);
  const barHeights = useMemo(() => {
    const barArea = Math.max(0, height - VALUE_LANE);
    return data.map((d) =>
      d.value > 0 && max > 0 ? Math.max(MIN_BAR_HEIGHT, (d.value / max) * barArea) : 0,
    );
  }, [data, max, height]);

  // Число — над столбиком (bottom = высота + зазор); раскладка не пускает его
  // ни на соседние числа, ни на соседние более высокие столбики.
  const valueLabels = useMemo(
    () =>
      placeColumnLabels(
        data.flatMap((d, index) =>
          d.value > 0
            ? [{ index, text: fmt(d.value), priority: d.value, bottom: barHeights[index] + LABEL_GAP }]
            : [],
        ),
        { count: data.length, width, gap: GAP, barWidthMax: MAX_BAR_WIDTH, barHeights },
        { charWidth: VALUE_CHAR_W, lineHeight: VALUE_LINE },
      ),
    [data, width, barHeights],
  );
  const axisLabels = useMemo(
    () =>
      placeColumnLabels(
        data.flatMap((d, index) =>
          d.axisLabel ? [{ index, text: d.axisLabel, priority: d.axisPriority ?? 0 }] : [],
        ),
        { count: data.length, width, gap: GAP },
        { charWidth: AXIS_CHAR_W, minSpacing: 8 },
      ),
    [data, width],
  );

  if (!hasData) {
    return <EmptyState icon={LineChart} title="Пока нет данных" />;
  }

  const activeKey = hoverKey ?? selectedKey;
  const active = activeKey ? data.find((d) => d.key === activeKey) ?? null : null;
  const peak = max > 0 ? [...data].reverse().find((d) => d.value === max) ?? null : null;

  return (
    <div>
      {/* Строка выбора фиксированной высоты — график не прыгает при тапе.
          Одна строка; если не влезает, многоточием режется только имя дня,
          а «— 1 234 регистрации» не сжимается: ради числа строка и нужна. */}
      <div
        aria-live="polite"
        className="flex min-w-0"
        style={{
          minHeight: 20,
          lineHeight: '20px',
          fontSize: 13,
          marginBottom: 8,
          color: 'var(--color-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {active ? (
          <>
            <span className="min-w-0 truncate" style={{ color: 'var(--color-ink)', fontWeight: 700 }}>
              {active.title}
            </span>
            <span style={{ flexShrink: 0, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
              {/* неразрывный пробел: обычный в начале флекс-элемента схлопнется */}
              {'\u00A0— '}
              {withUnit(active.value, unit)}
            </span>
          </>
        ) : peak ? (
          <>
            <span className="min-w-0 truncate">Пик: {peak.peakTitle ?? peak.title}</span>
            <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {'\u00A0— '}
              {withUnit(peak.value, unit)}
            </span>
          </>
        ) : (
          <span className="min-w-0 truncate">За период — {withUnit(0, unit)}</span>
        )}
      </div>

      <div ref={plotRef} style={{ position: 'relative', height }}>
        <div
          role="group"
          aria-label={label}
          onPointerLeave={() => setHoverKey(null)}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
            columnGap: GAP,
            height: '100%',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          {data.map((d, i) => {
            const dim = activeKey !== null && activeKey !== d.key;
            return (
              <button
                key={d.key}
                type="button"
                aria-label={`${d.title}: ${withUnit(d.value, unit)}`}
                aria-pressed={selectedKey === d.key}
                // Вся колонка — зона касания: у нулевого дня столбика нет,
                // но день всё равно можно выбрать
                onClick={() => setSelectedKey((k) => (k === d.key ? null : d.key))}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setHoverKey(d.key);
                }}
                className="flex h-full min-w-0 items-end justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  padding: 0,
                  border: 0,
                  // Подсветка колонки: у выбранного нулевого дня столбика нет,
                  // и без фона не видно, какой день выбран
                  background: d.key === activeKey ? 'var(--border-hairline)' : 'transparent',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer',
                  outlineColor: 'var(--color-brand)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: MAX_BAR_WIDTH,
                    height: barHeights[i],
                    background: color,
                    borderRadius: '4px 4px 0 0',
                    opacity: dim ? 0.35 : 1,
                    transition: 'opacity var(--dur-fast, 120ms) ease-out',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Числа над столбиками: абсолютом поверх грида, те же координаты */}
        {width > 0 &&
          valueLabels.map((l) => {
            const d = data[l.index];
            const isActive = d.key === activeKey;
            return (
              <span
                key={d.key}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: l.left,
                  width: l.width,
                  // +1 — нижняя hairline-граница грида
                  bottom: l.bottom + 1,
                  fontSize: VALUE_FONT,
                  lineHeight: `${VALUE_LINE}px`,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-ink)' : 'var(--color-muted)',
                  pointerEvents: 'none',
                }}
              >
                {l.text}
              </span>
            );
          })}
      </div>

      {/* Ось: даты по приоритету (сегодня, понедельники, первый день) без наложений */}
      <div aria-hidden style={{ position: 'relative', height: AXIS_HEIGHT, marginTop: 4 }}>
        {axisLabels.map((l) => (
          <span
            key={data[l.index].key}
            style={{
              position: 'absolute',
              left: l.left,
              width: l.width,
              top: 0,
              fontSize: AXIS_FONT,
              lineHeight: `${AXIS_HEIGHT}px`,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              color: 'var(--color-muted)',
            }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ряд «по дням» (из /api/admin/stats) → столбики с подписями дат. */
export function DailyBarChart({
  series,
  ...rest
}: {
  series: DailyPoint[];
  color: string;
  unit: UnitForms;
  height?: number;
  label: string;
}) {
  const data = useMemo<BarDatum[]>(
    () =>
      series.map((p, i) => {
        const l = dayLabels(p.date);
        const isLast = i === series.length - 1;
        const isFirst = i === 0;
        return {
          key: p.date,
          value: p.count,
          title: `${l.weekday}, ${l.short}${isLast ? ' (сегодня)' : ''}`,
          // «Пик: сегодня — 1 234 регистрации» влезает и в 320px
          peakTitle: isLast ? 'сегодня' : `${l.weekday}, ${l.short}`,
          // Сегодня важнее всего, затем понедельники (границы недель), затем
          // первый день окна — на узком экране остаются только те, что влезли
          axisLabel: isLast || isFirst || l.isMonday ? l.short : undefined,
          axisPriority: isLast ? 3 : l.isMonday ? 2 : 1,
        };
      }),
    [series],
  );
  return <BarChart data={data} {...rest} />;
}
