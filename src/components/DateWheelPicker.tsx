'use client';

// Колёсики выбора даты «гггг-мм-дд» (правка владельца «конец августа»):
// нативный <input type="date"> на мобильных открывает системный пикер, который
// в тёмной теме выглядит инородно и на Android бывает громоздким.
//
// Паттерн барабанов взят из ScheduleModal (выбор времени), но с исправлениями:
//  · индекс считается по ОСТАНОВКЕ скролла (дебаунс), а не на каждом событии —
//    иначе на iOS-инерции состояние дёргается, а барабан дней перерисовывается
//    прямо под пальцем и прыгает;
//  · начальная позиция ставится через scrollTop, а НЕ scrollIntoView — тот
//    прокручивает и родителя (латентный баг оригинала);
//  · день клампится по длине месяца: 31 марта → февраль даёт 28/29.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampDay, daysInMonth, parseDateString, toDateString } from '@/lib/age-utils';

const ITEM_H = 28; // синхронизировано с h-7 у пункта
const VISIBLE_H = 128; // h-32
const PAD = (VISIBLE_H - ITEM_H) / 2; // отступ, чтобы первый/последний вставали по центру

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function Wheel({
  items,
  index,
  onIndexChange,
  ariaLabel,
  width,
}: {
  items: string[];
  index: number;
  onIndexChange: (i: number) => void;
  ariaLabel: string;
  width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Пока пользователь крутит — не дёргаем позицию извне (иначе борьба со скроллом)
  const scrolling = useRef(false);

  // Позиционируем барабан при внешней смене значения (в т.ч. на первом рендере)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || scrolling.current) return;
    el.scrollTop = index * ITEM_H;
  }, [index]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        scrolling.current = true;
        if (timer.current) clearTimeout(timer.current);
        // Ждём остановки: onScroll на инерции стреляет десятки раз
        timer.current = setTimeout(() => {
          scrolling.current = false;
          const next = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
          // Доводим до «щелчка» — snap иногда оставляет полпикселя
          el.scrollTop = next * ITEM_H;
          if (next !== index) onIndexChange(next);
        }, 120);
      }}
      className="h-32 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{
        width,
        paddingTop: PAD,
        paddingBottom: PAD,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}
    >
      {items.map((label, i) => (
        <div
          key={label}
          role="option"
          aria-selected={i === index}
          className={`h-7 flex items-center justify-center snap-center transition-all ${
            i === index ? 'text-white text-[17px] font-bold' : 'text-muted text-[14px] opacity-50'
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

export default function DateWheelPicker({
  value,
  onChange,
  minYear,
  maxYear,
}: {
  /** 'YYYY-MM-DD' или пусто */
  value: string | null;
  onChange: (next: string) => void;
  minYear?: number;
  maxYear?: number;
}) {
  // Диапазон: хоккеисту 7-100 лет (см. isValidBirthDate). Границы считаем один
  // раз при монтировании — год не меняется под пользователем.
  const [range] = useState(() => {
    const current = new Date().getFullYear();
    return { min: minYear ?? current - 100, max: maxYear ?? current - 5 };
  });
  const years: number[] = [];
  for (let y = range.max; y >= range.min; y -= 1) years.push(y);

  const parsed = parseDateString(value);
  // Дефолт при пустом значении — середина диапазона подростков, а не 1925 год
  const fallbackYear = Math.min(range.max, new Date().getFullYear() - 12);
  const year = parsed?.year ?? fallbackYear;
  const month = parsed?.month ?? 1;
  const day = parsed?.day ?? 1;

  const emit = (y: number, m: number, d: number) => {
    onChange(toDateString(y, m, clampDay(y, m, d)));
  };

  const yearIndex = Math.max(0, years.indexOf(year));
  const dayCount = daysInMonth(year, month);

  return (
    <div className="relative py-2">
      {/* Полоса выделения по центру */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-7 bg-[#1C2344] rounded-xl pointer-events-none z-0" />
      <div className="flex justify-center gap-2 relative z-10">
        <Wheel
          ariaLabel="Год рождения"
          width={84}
          items={years.map(String)}
          index={yearIndex}
          onIndexChange={(i) => emit(years[i], month, day)}
        />
        <Wheel
          ariaLabel="Месяц рождения"
          width={110}
          items={MONTHS}
          index={month - 1}
          onIndexChange={(i) => emit(year, i + 1, day)}
        />
        <Wheel
          ariaLabel="День рождения"
          width={64}
          items={Array.from({ length: dayCount }, (_, i) => String(i + 1))}
          index={Math.min(day, dayCount) - 1}
          onIndexChange={(i) => emit(year, month, i + 1)}
        />
      </div>
    </div>
  );
}
