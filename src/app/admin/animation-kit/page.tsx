'use client';

// Кит анимаций «Треньки» — живая витрина движения, парная к /admin/ui-kit.
// Здесь ЖИВЫЕ классы/токены из globals.css (не копии): каждый блок можно
// проиграть заново и скопировать имя класса. Доступ — только админам
// (middleware + admin layout, как у ui-kit).
//
// Философия: токены движения (--dur-*, --ease-*) — такие же токены, как цвет
// и отступы. Анимации не выдумываются на месте — берутся отсюда.

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Check,
  Clapperboard,
  Film,
  Palette,
  RotateCcw,
  Star,
  Zap,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import CountUp from '@/components/anim/CountUp';

const NAV = [
  { id: 'tokens', label: 'Токены' },
  { id: 'enter', label: 'Появление' },
  { id: 'press', label: 'Нажатие' },
  { id: 'feedback', label: 'Обратная связь' },
  { id: 'numbers', label: 'Числа' },
  { id: 'rules', label: 'Правила' },
];

const DUR_TOKENS = [
  { name: '--dur-fast', ms: 120, role: 'отклик на тап (press, переключатели)' },
  { name: '--dur-base', ms: 200, role: 'ховеры, смена состояний' },
  { name: '--dur-slow', ms: 300, role: 'модалки/шторки (animate-popIn, animate-slideUp)' },
  { name: '--dur-enter', ms: 400, role: 'въезд контента (.anim-rise, .anim-stagger)' },
];

const EASE_TOKENS = [
  { name: '--ease-out', value: 'cubic-bezier(0.16, 1, 0.3, 1)', role: 'дефолт появления: «прилетел и мягко встал»' },
  { name: '--ease-in-out', value: 'cubic-bezier(0.65, 0, 0.35, 1)', role: 'симметричные переходы, пульсы' },
  { name: '--ease-spring', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)', role: 'overshoot — игривость: успехи, геймификация' },
];

function SectionHeader({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-lg font-bold text-white uppercase tracking-wider mb-4 pt-2 border-t border-white/5"
    >
      {children}
    </h2>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <code className="block mt-2 font-mono text-[11px] text-gray-500 break-words">{children}</code>
  );
}

/** Ячейка с кнопкой «проиграть заново»: ремоунт демо через key. */
function ReplayCell({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  const [nonce, setNonce] = useState(0);
  return (
    <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div key={nonce} className="flex-1 min-w-0">
          {children}
        </div>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          aria-label="Проиграть заново"
          className="shrink-0 text-gray-400 hover:text-brand transition-colors"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <Caption>{caption}</Caption>
    </div>
  );
}

export default function AnimationKitPage() {
  const [xp, setXp] = useState(1240);
  const [shakeNonce, setShakeNonce] = useState(0);

  return (
    <div
      className="min-h-screen bg-night text-white px-4 pb-16 md:px-8"
      style={{ paddingTop: 'calc(var(--safe-top) + var(--space-4))' }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Шапка: назад в админку + переход в парный UI-кит */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="text-white hover:text-gray-300 transition-colors" aria-label="Назад в админку">
              <Image src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Film size={24} className="text-brand" aria-hidden />
              Кит анимаций
            </h1>
          </div>
          <Link
            href="/admin/ui-kit"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-brand transition-colors shrink-0"
          >
            <Palette size={16} aria-hidden />
            UI-кит
          </Link>
        </div>
        <p className="text-sm text-muted mb-4">
          Движение — из токенов, как цвет и отступы. Всё ниже — живые классы из{' '}
          <code className="font-mono text-[11px]">globals.css</code>; при{' '}
          <code className="font-mono text-[11px]">prefers-reduced-motion</code> анимации отключаются.
        </p>

        {/* Sticky-навигация */}
        <nav className="sticky top-0 z-10 -mx-4 px-4 md:-mx-8 md:px-8 py-2 mb-8 bg-night/90 backdrop-blur border-b border-white/5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 whitespace-nowrap">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-brand px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-10">
          {/* ═══════════ ТОКЕНЫ ═══════════ */}
          <section>
            <SectionHeader id="tokens">Токены движения</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 space-y-2">
                {DUR_TOKENS.map((t) => (
                  <div key={t.name} className="leading-tight">
                    <span className="font-mono text-xs text-brand">{t.name}</span>
                    <span className="font-mono text-xs text-gray-500"> · {t.ms}ms</span>
                    <span className="text-[11px] text-muted"> · {t.role}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 space-y-2">
                {EASE_TOKENS.map((t) => (
                  <div key={t.name} className="leading-tight">
                    <span className="font-mono text-xs text-brand">{t.name}</span>
                    <span className="text-[11px] text-muted"> · {t.role}</span>
                  </div>
                ))}
              </div>
            </div>
            <Caption>{`transition: transform var(--dur-fast) var(--ease-out)`}</Caption>
          </section>

          {/* ═══════════ ПОЯВЛЕНИЕ ═══════════ */}
          <section>
            <SectionHeader id="enter">Появление</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReplayCell caption={`<Card className="anim-rise">`}>
                <Card variant="outlined" className="anim-rise" style={{ padding: 16 }}>
                  <div className="text-sm font-bold text-ink">Въезд карточки</div>
                  <div className="text-xs text-muted mt-1">снизу + проявление, 400ms ease-out</div>
                </Card>
              </ReplayCell>

              <ReplayCell caption={`<div className="anim-stagger"> — каскад детей (шаг 40ms, до 8)`}>
                <div className="anim-stagger space-y-2">
                  {['Первый', 'Второй', 'Третий', 'Четвёртый'].map((t) => (
                    <Card key={t} variant="stat" style={{ padding: 10 }}>
                      <div className="text-xs text-ink">{t} элемент списка</div>
                    </Card>
                  ))}
                </div>
              </ReplayCell>

              <ReplayCell caption={`animate-popIn — модалки (существующий)`}>
                <Card variant="accent" className="animate-popIn" style={{ padding: 16 }}>
                  <div className="text-sm font-bold text-ink">Поп-ин модалки</div>
                </Card>
              </ReplayCell>

              <ReplayCell caption={`animate-slideUp — шторки снизу (существующий)`}>
                <Card variant="blue" className="animate-slideUp" style={{ padding: 16 }}>
                  <div className="text-sm font-bold text-ink">Шторка</div>
                </Card>
              </ReplayCell>
            </div>
          </section>

          {/* ═══════════ НАЖАТИЕ ═══════════ */}
          <section>
            <SectionHeader id="press">Нажатие</SectionHeader>
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 flex flex-wrap items-center gap-3">
              <Button>ui-pressable внутри</Button>
              <button
                type="button"
                className="ui-pressable rounded-full px-5 py-2.5 bg-brand text-night font-overpass font-extrabold uppercase text-sm"
              >
                Прижимается
              </button>
              <button
                type="button"
                className="anim-glow-pulse rounded-full px-5 py-2.5 bg-brand text-night font-overpass font-extrabold uppercase text-sm"
              >
                Пульс CTA
              </button>
            </div>
            <Caption>{`.ui-pressable (scale 0.97 на тап) · .anim-glow-pulse — ОДНА кнопка на экран`}</Caption>
          </section>

          {/* ═══════════ ОБРАТНАЯ СВЯЗЬ ═══════════ */}
          <section>
            <SectionHeader id="feedback">Обратная связь</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReplayCell caption={`.anim-pop-success — успех: галочки, звёзды, зачёт дня`}>
                <div className="flex items-center gap-4 h-12">
                  <span className="anim-pop-success inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand/20 text-brand">
                    <Check size={22} />
                  </span>
                  <span className="anim-pop-success inline-flex text-brand" style={{ animationDelay: '120ms' }}>
                    <Star size={24} fill="currentColor" />
                  </span>
                </div>
              </ReplayCell>

              <ReplayCell caption={`.anim-float-up — «+10 XP» всплывает и тает`}>
                <div className="relative h-12 flex items-center">
                  <span className="text-muted text-sm">Тренировка засчитана</span>
                  <span className="anim-float-up absolute left-40 inline-flex items-center gap-1 text-brand font-black font-overpass">
                    <Zap size={14} fill="currentColor" />
                    +10 XP
                  </span>
                </div>
              </ReplayCell>

              <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4">
                <div key={shakeNonce} className="anim-shake inline-block">
                  <input
                    readOnly
                    value="Неверный код"
                    className="rounded-lg px-3 py-2 text-sm text-danger bg-night border border-danger/50 outline-none"
                  />
                </div>
                <div className="mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setShakeNonce((n) => n + 1)}>
                    Показать тряску
                  </Button>
                </div>
                <Caption>{`.anim-shake — ошибка формы/действия`}</Caption>
              </div>
            </div>
          </section>

          {/* ═══════════ ЧИСЛА ═══════════ */}
          <section>
            <SectionHeader id="numbers">Числа</SectionHeader>
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-4 flex items-center gap-4">
              <div className="text-3xl font-black font-overpass text-brand tabular-nums">
                <CountUp value={xp} /> <span className="text-sm text-muted font-bold">XP</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setXp((v) => v + 180)}>
                +180 XP
              </Button>
            </div>
            <Caption>{`<CountUp value={xp} /> из @/components/anim/CountUp — бег числа с ease-out`}</Caption>
          </section>

          {/* ═══════════ ПРАВИЛА ═══════════ */}
          <section>
            <SectionHeader id="rules">Правила</SectionHeader>
            <div className="rounded-xl bg-[#1a1f3a] border border-white/5 p-5 space-y-3 text-sm text-muted leading-relaxed">
              <p>
                <strong className="text-white">Анимация — это ответ, не украшение.</strong> Каждое движение
                отвечает на действие юзера (тап, успех, ошибка) или объясняет изменение (появился новый блок).
                Ничего не должно шевелиться «просто так» — кроме одного пульса CTA на экран.
              </p>
              <p>
                <strong className="text-white">Быстро для мелкого, медленно для крупного.</strong> Тап — fast
                (120), состояние — base (200), модалка — slow (300), контент — enter (400). Дольше 400ms —
                только загрузки.
              </p>
              <p>
                <strong className="text-white">Спринг — только для радости.</strong> --ease-spring
                (overshoot) — успехи и геймификация. Навигация и формы — --ease-out, без прыжков.
              </p>
              <p>
                <strong className="text-white">Каскад — до 8 элементов.</strong> .anim-stagger не задерживает
                хвост длинных списков; въезд не должен мешать читать.
              </p>
              <p>
                <strong className="text-white">Уважать reduced-motion.</strong> Все классы кита гаснут при
                prefers-reduced-motion — новые анимации добавлять в тот же media-блок globals.css.
              </p>
              <p className="flex items-center gap-2">
                <Clapperboard size={16} className="text-brand shrink-0" aria-hidden />
                Новую анимацию сначала добавляй сюда, потом используй в продукте — как с UI-китом.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
