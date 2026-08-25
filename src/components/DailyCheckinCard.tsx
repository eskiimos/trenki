'use client';

// Ежедневный чекин на главной (правки «Конец августа»): сетка недели с
// растущими наградами (по выходным XP больше всего — мотиватор просевшей
// активности) и кнопка «Отметиться». Self-fetch /api/checkin, как StreakChip.
// Чекин НЕ трогает серию/темп — только плоский XP.

import { useEffect, useState } from 'react';
import { CalendarCheck, Check, Star } from 'lucide-react';

interface WeekDay {
  date: string;
  weekday: number; // getUTCDay: 0=Вс … 6=Сб
  xp: number;
  checked: boolean;
  isToday: boolean;
}

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default function DailyCheckinCard() {
  const [week, setWeek] = useState<WeekDay[] | null>(null);
  const [checkedToday, setCheckedToday] = useState(false);
  const [todayXp, setTodayXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justEarned, setJustEarned] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/checkin')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d?.week) return;
          setWeek(d.week);
          setCheckedToday(!!d.checkedToday);
          setTodayXp(d.todayXp ?? 0);
        })
        .catch(() => {});
    };
    load();
    // PWA живёт открытой сутками: без рефетча по возврату видимости наутро
    // кнопка оставалась «Сегодня отмечено» со вчера — чекин нового дня терялся.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const checkin = async () => {
    if (busy || checkedToday) return;
    setBusy(true);
    try {
      const res = await fetch('/api/checkin', { method: 'POST' });
      if (!res.ok) return;
      const d = await res.json();
      setCheckedToday(true);
      if (!d.alreadyChecked) setJustEarned(d.xpEarned);
      // Ячейку красим по СЕРВЕРНОЙ дате: клиентское «сегодня» могло протухнуть
      // (тап в 00:01 при карточке, загруженной до полуночи). Если серверная
      // дата вообще не из отображённой недели — просто перечитываем состояние.
      setWeek((prev) => {
        if (!prev) return prev;
        const target = d.date && prev.find((day) => day.date === d.date);
        if (!target) {
          fetch('/api/checkin')
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh) => {
              if (fresh?.week) {
                setWeek(fresh.week);
                setCheckedToday(!!fresh.checkedToday);
                setTodayXp(fresh.todayXp ?? 0);
              }
            })
            .catch(() => {});
          return prev;
        }
        return prev.map((day) => (day.date === d.date ? { ...day, checked: true } : day));
      });
    } catch {
    } finally {
      setBusy(false);
    }
  };

  // Пока не загрузилось — не занимаем место на главной
  if (!week) return null;

  return (
    // Отступ сверху — как у StreakChip (12): без него карточка прилипала к
    // блоку серии (правка владельца)
    <section className="px-4" style={{ paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)' }}>
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--border-hairline)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarCheck size={20} className="text-brand shrink-0" aria-hidden />
            <span className="text-white text-sm font-bold font-overpass uppercase tracking-wide truncate">
              Ежедневный чекин
            </span>
          </div>
          {justEarned !== null && (
            <span className="inline-flex items-center gap-1 text-brand text-sm font-black font-overpass shrink-0">
              <Star size={16} fill="currentColor" aria-hidden />
              +{justEarned} XP
            </span>
          )}
        </div>

        {/* Неделя: Пн…Вс, награда растёт к выходным */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {week.map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center rounded-lg py-1.5"
              style={{
                background: day.checked
                  ? 'var(--lime-medium)'
                  : day.isToday
                    ? 'rgba(255,255,255,0.08)'
                    : 'transparent',
                border: `1px solid ${
                  day.isToday ? 'var(--color-brand)' : day.checked ? 'transparent' : 'var(--border-hairline)'
                }`,
              }}
            >
              <span
                className={`text-[10px] font-bold font-overpass uppercase ${
                  day.isToday ? 'text-brand' : 'text-muted'
                }`}
              >
                {WEEKDAY_SHORT[day.weekday]}
              </span>
              {day.checked ? (
                <Check size={14} className="text-brand mt-0.5" aria-hidden />
              ) : (
                <span className="text-[10px] text-muted mt-0.5 tabular-nums">+{day.xp}</span>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={checkin}
          disabled={busy || checkedToday}
          className="w-full rounded-full font-overpass font-extrabold uppercase text-[13px] tracking-[0.4px] py-2.5 transition-transform active:scale-95 disabled:active:scale-100"
          style={
            checkedToday
              ? {
                  background: 'transparent',
                  border: '1px solid var(--border-hairline)',
                  color: 'var(--color-muted)',
                }
              : {
                  background: 'var(--color-brand)',
                  border: 'none',
                  color: 'var(--color-night)',
                }
          }
        >
          {checkedToday ? 'Сегодня отмечено' : busy ? 'Секунду…' : `Отметиться · +${todayXp} XP`}
        </button>
      </div>
    </section>
  );
}
