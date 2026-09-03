'use client';

// Бейдж «Ударный темп» с объяснялкой по тапу. Правка владельца («Начало
// сентября»): раньше тап уводил на страницу ачивок, а что такое «ударный темп»
// и как его включить — оставалось непонятным. Нижний лист в стиле
// HowAiWorksModal; правила берутся из констант геймификации, чтобы текст не
// разъезжался с расчётом.

import { useState } from 'react';
import { Flame, CalendarCheck, Zap, ClipboardCheck, X, type LucideIcon } from 'lucide-react';
import { TEMPO_MIN_STREAK, TEMPO_MULTIPLIER } from '@/lib/gamification';
import { plural } from '@/lib/plural';
import TempoBadge from '@/components/TempoBadge';

const DAYS: [string, string, string] = ['день', 'дня', 'дней'];

const RULES: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: Zap,
    title: `Опыт ×${TEMPO_MULTIPLIER}`,
    text: `Пока темп активен, XP за тренировки и модули умножается на ${TEMPO_MULTIPLIER}.`,
  },
  {
    Icon: CalendarCheck,
    title: `Включается на ${TEMPO_MIN_STREAK}-й день подряд`,
    text: `Тренируйся ${TEMPO_MIN_STREAK} ${plural(TEMPO_MIN_STREAK, DAYS)} подряд — с ${TEMPO_MIN_STREAK}-го дня множитель уже работает.`,
  },
  {
    Icon: Flame,
    title: 'Действует, пока тренируешься каждый день',
    text: 'Пропустил день — серия обнуляется, и темп нужно набирать заново.',
  },
  {
    Icon: ClipboardCheck,
    title: 'Чек-ин серию не продлевает',
    text: 'Считаются только тренировки. Ежедневная отметка даёт XP, но серию не держит.',
  },
];

export default function TempoBadgeButton({
  streak,
  tempoActive,
}: {
  streak: number;
  tempoActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const safeStreak = Math.max(0, streak);
  const daysLeft = Math.max(1, TEMPO_MIN_STREAK - safeStreak);

  const status = tempoActive
    ? `Темп активен — серия ${safeStreak} ${plural(safeStreak, DAYS)}`
    : safeStreak > 0
      ? `Серия ${safeStreak} ${plural(safeStreak, DAYS)} · до темпа ещё ${daysLeft} ${plural(daysLeft, DAYS)}`
      : `Начни серию — до темпа ${TEMPO_MIN_STREAK} ${plural(TEMPO_MIN_STREAK, DAYS)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex cursor-pointer transition-transform active:scale-95 bg-transparent border-0 p-0"
      >
        <TempoBadge streak={streak} tempoActive={tempoActive} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ударный темп"
          onClick={() => setOpen(false)}
          className="fixed inset-0 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 70 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full font-overpass"
            style={{
              maxWidth: 480,
              backgroundColor: '#101530',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '24px 20px calc(env(safe-area-inset-bottom) + 24px)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-ink font-extrabold text-xl uppercase tracking-wide flex items-center gap-2">
                <Flame
                  size={22}
                  className={tempoActive ? 'text-brand' : 'text-[#FF8C4A]'}
                  fill="currentColor"
                  aria-hidden
                />
                Ударный темп ×{TEMPO_MULTIPLIER}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="text-muted p-1 bg-transparent border-0 cursor-pointer"
              >
                <X size={22} aria-hidden />
              </button>
            </div>

            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm font-bold"
              style={{
                background: tempoActive ? 'var(--lime-subtle)' : 'rgba(255,140,74,0.12)',
                color: tempoActive ? 'var(--color-brand)' : '#FF8C4A',
              }}
            >
              {status}
            </div>

            <div className="flex flex-col gap-3">
              {RULES.map(({ Icon, title, text }) => (
                <div key={title} className="flex gap-3">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--lime-subtle)', color: 'var(--color-brand)' }}
                  >
                    <Icon size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="text-ink font-bold text-sm">{title}</div>
                    <div className="text-muted text-[13px] leading-snug">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
