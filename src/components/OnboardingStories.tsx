'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * Сторис-онбординг в стиле Instagram. Пока доступен только из админ-
 * профиля по кнопке (feature-flag). Когда дизайн утвердят — будет
 * автоматически открываться один раз после прохождения онбординга.
 *
 * Слайды — pixel-perfect mock'и реальных секций приложения, чтобы
 * атлет сразу узнал что увидит на экране.
 *
 * Управление:
 *   • тап в левую треть — назад
 *   • тап в правую часть — вперёд (на последнем слайде закрывает)
 *   • удержание >200мс — пауза прогресса
 *   • свайп вниз — закрыть
 *   • ✕ — закрыть
 *   • автопереход через STORY_DURATION_MS
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

const STORY_DURATION_MS = 5500;
const TAP_HOLD_DELAY_MS = 220;
const TAP_LEFT_ZONE = 0.33; // 33% слева = «назад»

// =====================================================================
//                             СЛАЙДЫ
// =====================================================================

const SLIDE_BG =
  'radial-gradient(circle at 50% 0%, rgba(68, 92, 255, 0.18) 0%, rgba(6, 9, 25, 0) 55%), #060919';

// ── 1. Welcome ────────────────────────────────────────────────────────
function SlideWelcome() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        height: '100%',
        background:
          'radial-gradient(circle at 50% 35%, rgba(161, 255, 74, 0.20) 0%, transparent 55%), #060919',
      }}
    >
      <div
        className="font-overpass uppercase animate-popIn"
        style={{
          color: '#F9F8FE',
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: '0.05em',
          lineHeight: '90%',
          textAlign: 'center',
        }}
      >
        треньки
      </div>
      <div
        className="font-overpass mt-3 animate-fadeIn"
        style={{
          color: '#A1FF4A',
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.4em',
          animationDelay: '0.15s',
        }}
      >
        для хоккеиста
      </div>
    </div>
  );
}

// ── 2. Главная (3 карточки TrainingsSection) ─────────────────────────
function SlideHomeCards() {
  // Pixel-perfect копия src/app/page.tsx:683-728
  return (
    <div className="animate-fadeIn" style={{ paddingTop: 32 }}>
      <div
        className="font-overpass uppercase"
        style={{
          color: '#9B99AA',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.5px',
          paddingLeft: 16,
          marginBottom: 12,
        }}
      >
        Главная
      </div>
      <section className="px-4">
        <div className="grid grid-cols-2 gap-2">
          {/* ИИ тренер — col-span-2 на мобиле */}
          <div
            className="col-span-2 animate-slideUp"
            style={{
              width: '100%',
              height: 100,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 12,
              paddingBottom: 12,
              background: 'rgba(68, 92, 255, 0.20)',
              overflow: 'hidden',
              borderRadius: 8,
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              display: 'flex',
            }}
          >
            <Image src="/icons/icon-cards.svg" alt="" width={24} height={24} />
            <div
              style={{
                color: '#F9F8FE',
                fontSize: 14,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                lineHeight: '120%',
                letterSpacing: 0.5,
              }}
            >
              персональный <span style={{ color: '#A1FF4A' }}>ИИ</span> тренер
            </div>
          </div>
          {/* Повышение потенциала */}
          <div
            className="animate-slideUp"
            style={{
              width: '100%',
              height: 100,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 12,
              paddingBottom: 12,
              background: 'rgba(68, 92, 255, 0.20)',
              overflow: 'hidden',
              borderRadius: 8,
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              display: 'flex',
              animationDelay: '0.08s',
            }}
          >
            <Image src="/icons/ant-design-thunderbolt-filled_f.svg" alt="" width={16} height={16} />
            <div
              style={{
                color: '#F9F8FE',
                fontSize: 14,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                lineHeight: '120%',
                letterSpacing: 0.5,
                wordWrap: 'break-word',
              }}
            >
              повышение потенциала
            </div>
          </div>
          {/* Треньки, советы профи, разборы */}
          <div
            className="animate-slideUp"
            style={{
              width: '100%',
              height: 100,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 12,
              paddingBottom: 12,
              background: 'rgba(68, 92, 255, 0.20)',
              overflow: 'hidden',
              borderRadius: 8,
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              display: 'flex',
              animationDelay: '0.16s',
            }}
          >
            <Image src="/icons/icon-cards-kl.svg" alt="" width={16} height={16} />
            <div
              style={{
                color: '#F9F8FE',
                fontSize: 14,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                lineHeight: '120%',
                letterSpacing: 0.5,
                wordWrap: 'break-word',
              }}
            >
              треньки, советы профи, разборы
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── 3. Назначения от тренера (AssignmentsBanner) ──────────────────────
function SlideCoachAssignment() {
  // Pixel-perfect копия src/components/AssignmentsBanner.tsx
  return (
    <div className="animate-fadeIn" style={{ paddingTop: 32 }}>
      <div
        className="font-overpass uppercase"
        style={{
          color: '#9B99AA',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.5px',
          paddingLeft: 16,
          marginBottom: 12,
        }}
      >
        Главная — баннер
      </div>
      <section className="px-4">
        <div
          className="animate-slideUp"
          style={{
            width: '100%',
            padding: 16,
            background:
              'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
            border: '1px solid rgba(161, 255, 74, 0.25)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div
              style={{
                color: '#A1FF4A',
                fontSize: 12,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                lineHeight: '120%',
              }}
            >
              от тренера
            </div>
            <div
              style={{
                color: '#F9F8FE',
                fontSize: 14,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                lineHeight: '120%',
                wordWrap: 'break-word',
              }}
            >
              <span style={{ color: '#A1FF4A' }}>3</span> тренировки ждут выполнения
            </div>
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'rgba(161, 255, 74, 0.15)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4l4 4-4 4"
                stroke="#A1FF4A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── 4. Календарь (виджет + карточка тренировки) ───────────────────────
function SlideCalendar() {
  // Pixel-perfect mock из src/app/calendar/page.tsx
  const days = Array.from({ length: 35 }, (_, i) => i - 5); // фейк-сетка
  const todayIdx = 12;
  const eventIdxs = [12, 15, 19, 23];
  return (
    <div className="animate-fadeIn" style={{ paddingTop: 32 }}>
      <div
        className="font-overpass uppercase"
        style={{
          color: '#9B99AA',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.5px',
          paddingLeft: 16,
          marginBottom: 8,
        }}
      >
        Календарь
      </div>
      <h1
        className="font-overpass uppercase"
        style={{
          paddingLeft: 16,
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.5px',
          color: '#F9F8FE',
          marginBottom: 16,
        }}
      >
        КАЛЕНДАРЬ
      </h1>

      <div className="px-4">
        {/* Виджет календаря */}
        <div
          className="bg-[#101530] rounded-3xl mb-5 animate-slideUp"
          style={{ overflow: 'hidden' }}
        >
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(68, 92, 255, 0.20)' }}
          >
            {/* Навигация месяцев */}
            <div className="flex items-center justify-between mb-4 text-white">
              <span style={{ fontSize: 20, opacity: 0.7 }}>‹</span>
              <span className="text-[13px] font-bold uppercase tracking-widest">
                ИЮНЬ, 2026
              </span>
              <span style={{ fontSize: 20, opacity: 0.7 }}>›</span>
            </div>
            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((d) => (
                <div
                  key={d}
                  style={{
                    color: '#AEABBB',
                    fontSize: 11,
                    fontWeight: 700,
                    fontStyle: 'italic',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Сетка дней */}
            <div className="grid grid-cols-7 gap-1 place-items-center">
              {days.map((d, i) => {
                const isVisible = d >= 1 && d <= 30;
                const isToday = i === todayIdx;
                const hasEvent = eventIdxs.includes(i);
                return (
                  <div
                    key={i}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 999,
                      position: 'relative',
                      fontSize: 12,
                      fontWeight: 600,
                      color: isVisible ? '#F9F8FE' : 'transparent',
                      background: isToday ? '#445CFF' : 'transparent',
                    }}
                  >
                    {isVisible ? d : ''}
                    {hasEvent && !isToday && isVisible && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          width: 4,
                          height: 4,
                          borderRadius: 999,
                          background: '#445CFF',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Заголовок выбранной даты */}
        <div
          className="font-overpass text-white"
          style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}
        >
          Сегодня, 13 июня
        </div>

        {/* Карточка тренерского задания (зелёный градиент) */}
        <div
          className="animate-slideUp"
          style={{
            background:
              'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
            border: '1px solid rgba(161, 255, 74, 0.25)',
            borderRadius: 16,
            padding: 12,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            animationDelay: '0.12s',
          }}
        >
          <div
            className="relative shrink-0"
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: '#0d1228',
              overflow: 'hidden',
            }}
          >
            <div
              className="skeleton-loading"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div
              style={{
                color: '#A1FF4A',
                fontSize: 11,
                fontFamily: 'Overpass',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              от тренера · Никита
            </div>
            <div
              className="font-overpass"
              style={{
                color: '#F9F8FE',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: '120%',
                marginBottom: 4,
              }}
            >
              Сила ног, уровень 2
            </div>
            <div
              className="font-overpass"
              style={{ color: '#AEABBB', fontSize: 11 }}
            >
              18 мин
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 5. Прогресс / Потенциал ───────────────────────────────────────────
function SlideProgress() {
  const ratings = [
    { label: 'Сила', val: 68 },
    { label: 'Скорость', val: 54 },
    { label: 'Выносливость', val: 47 },
    { label: 'Техника', val: 61 },
    { label: 'Гибкость', val: 39 },
  ];
  return (
    <div className="animate-fadeIn" style={{ paddingTop: 32 }}>
      <div
        className="font-overpass uppercase"
        style={{
          color: '#9B99AA',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.5px',
          paddingLeft: 16,
          marginBottom: 12,
        }}
      >
        Профиль
      </div>
      <section className="px-4">
        <div
          className="animate-popIn"
          style={{
            background: '#060919',
            border: '1px solid #26252F',
            borderRadius: 14,
            padding: '16px 18px',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className="font-overpass uppercase"
              style={{
                color: '#9B99AA',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              Потенциал
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className="font-overpass"
                style={{ color: '#A1FF4A', fontSize: 28, fontWeight: 900, lineHeight: 1 }}
              >
                54
              </div>
              <div
                className="font-overpass"
                style={{ color: '#A1FF4A', fontSize: 12, fontWeight: 800 }}
              >
                +8
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {ratings.map((r, i) => (
              <div key={r.label}>
                <div className="flex justify-between font-overpass" style={{ fontSize: 12 }}>
                  <span style={{ color: '#AEABBB' }}>{r.label}</span>
                  <span style={{ color: '#F9F8FE', fontWeight: 800 }}>{r.val}</span>
                </div>
                <div
                  style={{
                    background: '#1a1f3a',
                    borderRadius: 999,
                    height: 6,
                    marginTop: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${r.val}%`,
                      height: '100%',
                      background: '#A1FF4A',
                      borderRadius: 999,
                      transformOrigin: 'left',
                      animation: `popIn 0.7s ease-out ${i * 0.08}s both`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

interface Slide {
  title: string;
  body: string;
  visual: React.ReactNode;
  cta?: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Привет в Треньках!',
    body: 'Цифровая среда для хоккеиста: персональные тренировки, разборы профи и работа с твоим тренером.',
    visual: <SlideWelcome />,
  },
  {
    title: 'Подбор под тебя',
    body: 'На главной — три входа: ИИ-тренер собирает тренировку под твоё состояние, прокачиваешь характеристики, смотришь короткие разборы.',
    visual: <SlideHomeCards />,
  },
  {
    title: 'Тренировки от твоего тренера',
    body: 'Тренер назначает задание — оно появится на главной и в календаре, ты получишь уведомление за 30 и 10 минут.',
    visual: <SlideCoachAssignment />,
  },
  {
    title: 'Календарь тренировок',
    body: 'Все запланированные тренировки в одном месте — и от тренера, и из твоего плана. Видишь свой ритм недели.',
    visual: <SlideCalendar />,
  },
  {
    title: 'Растёшь с каждой тренировкой',
    body: 'Сила, скорость, выносливость, техника и гибкость — следи как растёт твой потенциал.',
    cta: 'Поехали',
    visual: <SlideProgress />,
  },
];

// =====================================================================
//                            КОМПОНЕНТ
// =====================================================================

export default function OnboardingStories({ open, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  // pointer-state для одновременного pause-hold + tap-navigation + swipe-down
  const pointerRef = useRef<{ startX: number; startY: number; t: number; held: boolean; holdTimer: number | null } | null>(null);

  const total = SLIDES.length;
  const current = SLIDES[idx];

  const next = useCallback(() => {
    setProgress(0);
    setIdx((i) => (i + 1 < total ? i + 1 : i));
  }, [total]);

  const prev = useCallback(() => {
    setProgress(0);
    setIdx((i) => (i > 0 ? i - 1 : 0));
  }, []);

  const close = useCallback(() => {
    setIdx(0);
    setProgress(0);
    onClose();
  }, [onClose]);

  // Авто-переход через animation frame
  useEffect(() => {
    if (!open) return;
    if (paused) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      setProgress((p) => {
        const np = p + dt / STORY_DURATION_MS;
        if (np >= 1) {
          if (idx + 1 < total) {
            setIdx(idx + 1);
            return 0;
          }
          return 1;
        }
        return np;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, paused, idx, total]);

  // body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Esc + клавиши
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, prev, next]);

  if (!open) return null;

  // Универсальный pointer-обработчик (работает и на мышке, и на тач):
  //  • short tap (<TAP_HOLD_DELAY_MS, без вертикального свайпа) → навигация по координате X
  //  • long press → пауза, до отпускания
  //  • swipe down >80px → close
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      t: performance.now(),
      held: false,
      holdTimer: window.setTimeout(() => {
        if (pointerRef.current) {
          pointerRef.current.held = true;
          setPaused(true);
        }
      }, TAP_HOLD_DELAY_MS),
    };
  };

  const handlePointerUp = (e: React.PointerEvent, viewportWidth: number) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    if (!p) return;
    if (p.holdTimer !== null) clearTimeout(p.holdTimer);
    if (p.held) {
      setPaused(false);
      return;
    }
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    // Свайп вниз — закрыть
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      close();
      return;
    }
    // Слишком большой свайп по X — игнорируем (не считаем тапом)
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) return;
    // Короткий тап → навигация по координате
    const relX = e.clientX / Math.max(1, viewportWidth);
    if (relX < TAP_LEFT_ZONE) {
      if (idx > 0) prev();
    } else {
      if (idx + 1 < total) next();
      else close();
    }
  };

  const handlePointerCancel = () => {
    const p = pointerRef.current;
    pointerRef.current = null;
    if (p?.holdTimer !== null && p?.holdTimer !== undefined) clearTimeout(p.holdTimer);
    if (p?.held) setPaused(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: SLIDE_BG,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        touchAction: 'none', // отключает default тач-жесты (swipe-back и т.п.)
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={(e) => handlePointerUp(e, window.innerWidth)}
      onPointerCancel={handlePointerCancel}
    >
      {/* Прогресс-бары */}
      <div
        className="flex gap-1.5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 8,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {SLIDES.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.18)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%`,
                height: '100%',
                background: '#F9F8FE',
                transition: i === idx ? 'none' : 'width 0.2s linear',
              }}
            />
          </div>
        ))}
      </div>

      {/* Закрыть — отдельным pointer-handler чтобы не путать с навигацией */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => {
          e.stopPropagation();
          // отменяем потенциальную навигацию: очищаем pointer-state
          if (pointerRef.current?.holdTimer != null) clearTimeout(pointerRef.current.holdTimer);
          pointerRef.current = null;
          close();
        }}
        aria-label="Закрыть"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 22px)',
          right: 14,
          width: 34,
          height: 34,
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.10)',
          color: '#F9F8FE',
          border: 'none',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 3,
        }}
      >
        ✕
      </button>

      {/* Слайд (визуал + подпись + CTA). key={idx} перезапускает анимации входа */}
      <div
        key={idx}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {current.visual}
        </div>

        {/* Текст + CTA */}
        <div
          className="px-6"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 36px)',
            paddingTop: 20,
          }}
        >
          <div
            className="font-overpass uppercase animate-fadeInDown"
            style={{
              color: '#A1FF4A',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.4em',
              marginBottom: 8,
            }}
          >
            треньки · {idx + 1}/{total}
          </div>
          <h2
            className="font-overpass animate-fadeInDown"
            style={{
              color: '#F9F8FE',
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 10,
              animationDelay: '0.08s',
            }}
          >
            {current.title}
          </h2>
          <p
            className="font-overpass animate-fadeInDown"
            style={{
              color: '#AEABBB',
              fontSize: 14,
              lineHeight: 1.45,
              animationDelay: '0.16s',
            }}
          >
            {current.body}
          </p>

          {current.cta && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (pointerRef.current?.holdTimer != null) clearTimeout(pointerRef.current.holdTimer);
                pointerRef.current = null;
                close();
              }}
              className="font-overpass uppercase mt-6 transition-transform duration-100 active:scale-95"
              style={{
                background: '#A1FF4A',
                color: '#101530',
                border: 'none',
                borderRadius: 999,
                padding: '14px 28px',
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {current.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
