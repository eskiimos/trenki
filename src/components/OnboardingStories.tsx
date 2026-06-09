'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Plus, ThumbsUp, Trash2 } from 'lucide-react';

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
  /**
   * Опционально: что делать по клику на CTA (последний слайд, кнопка
   * «Поехали»). Если передано — управление полностью передаётся туда
   * (например, генерация микроцикла + редирект). Если не передано —
   * fallback на onClose (режим admin-превью).
   *
   * Если onComplete возвращает Promise — пока он pending, в сторис
   * показывается лоадер.
   */
  onComplete?: () => void | Promise<void>;
}

const STORY_DURATION_MS = 5500;
const TAP_HOLD_DELAY_MS = 220;
const TAP_LEFT_ZONE = 0.33; // 33% слева = «назад»

// =====================================================================
//                             СЛАЙДЫ
// =====================================================================

const SLIDE_BG =
  'radial-gradient(circle at 50% 0%, rgba(68, 92, 255, 0.18) 0%, rgba(6, 9, 25, 0) 55%), #060919';

// Spotlight-обёртки: focal-блок остаётся «sharp» + лёгкое свечение,
// остальное блюрится и темнеет — внимание уходит на фокус.
function Dim({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        filter: 'blur(3px) brightness(0.45)',
        opacity: 0.7,
        transition: 'filter 0.4s ease, opacity 0.4s ease',
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}

function Focus({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        filter: 'drop-shadow(0 0 24px rgba(161, 255, 74, 0.20))',
        animation: 'popIn 0.45s ease-out',
      }}
    >
      {children}
    </div>
  );
}

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

// ── Главная (общий mock для слайдов 2 и 3) ───────────────────────────
// Pixel-perfect mock из src/app/page.tsx: Header → ScheduledWorkoutSection →
// TrenkiSection → AssignmentsBanner → TrainingsSection → TrainersSection.
// Один и тот же экран; меняется только focal-блок (TrainingsSection для
// слайда «карточки», AssignmentsBanner для слайда «баннер»). Остальное —
// в Dim, чтобы фокус внимания сдвигался естественно, не уводя из контекста.
type HomeFocal = 'trainings' | 'banner';

function HomePageMock({ focal }: { focal: HomeFocal }) {
  const Wrap = ({ kind, children }: { kind: HomeFocal; children: React.ReactNode }) =>
    focal === kind ? <Focus>{children}</Focus> : <Dim>{children}</Dim>;

  return (
    <>
      {/* Header атлета — копия page.tsx:443-562 */}
      <Dim>
        <header
          style={{
            width: '100%',
            paddingBottom: 24,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 16,
            borderBottom: '1px #101530 solid',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            display: 'flex',
          }}
        >
          <div
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 4,
              display: 'flex',
            }}
          >
            <div
              style={{
                width: 40,
                paddingTop: 4,
                paddingBottom: 4,
                overflow: 'hidden',
                borderRadius: 2,
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  color: '#F9F8FE',
                  fontSize: 24,
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  lineHeight: '24px',
                }}
              >
                10
              </div>
              <div
                style={{
                  textAlign: 'center',
                  color: '#F9F8FE',
                  fontSize: 12,
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  lineHeight: '12px',
                  letterSpacing: 0.5,
                }}
              >
                ЦН
              </div>
            </div>
            <div
              style={{
                flex: '1 1 0',
                padding: 4,
                borderRadius: 2,
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: '100%',
                  paddingTop: 4,
                  paddingBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    color: '#F9F8FE',
                    fontSize: 16,
                    fontFamily: 'Overpass',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    lineHeight: '16px',
                    letterSpacing: 0.5,
                  }}
                >
                  БАХТИЯР
                </div>
              </div>
              <div
                style={{
                  width: '100%',
                  paddingTop: 4,
                  paddingBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    color: '#F9F8FE',
                    fontSize: 16,
                    fontFamily: 'Overpass',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    lineHeight: '16px',
                    letterSpacing: 0.5,
                  }}
                >
                  МИНГАЗОВ
                </div>
              </div>
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 4,
                background: '#101530',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image src="/icons/icon-app.svg" alt="" width={32} height={32} />
            </div>
          </div>
        </header>
      </Dim>

      {/* Шорты (Dim) */}
      <Dim>
        <section style={{ paddingTop: 15, paddingBottom: 15 }}>
          <h2
            className="px-4 text-white font-semibold mb-3"
            style={{ fontSize: 12 }}
          >
            КОРОТКИЕ ВИДЕО
          </h2>
          <div className="flex space-x-4 overflow-hidden pb-4 px-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-36"
                style={{
                  aspectRatio: '9 / 16',
                  borderRadius: 4,
                  background:
                    i % 2 === 0
                      ? 'linear-gradient(135deg, #1a2148 0%, #060919 100%)'
                      : 'linear-gradient(135deg, #101530 0%, #060919 100%)',
                }}
              />
            ))}
          </div>
        </section>
      </Dim>

      {/* ScheduledWorkoutSection mock — копия page.tsx:220-243 (Dim) */}
      <Dim>
        <section className="px-4 mb-4">
          <div className="self-stretch p-4 bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg flex flex-col gap-4 overflow-hidden">
            <div className="self-stretch flex justify-between items-start">
              <div className="flex-1 h-9 text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                запланированная тренировка через
              </div>
              <div className="w-16 h-8 px-2 py-1 bg-lime-400/20 rounded-lg flex justify-center items-center">
                <div className="text-lime-400 text-base font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                  04:32
                </div>
              </div>
            </div>
            <div
              className="self-stretch h-12 px-6 py-3 rounded-[32px] flex justify-center items-center"
              style={{ background: '#A1FF4A' }}
            >
              <div className="text-slate-950 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                начать
              </div>
            </div>
          </div>
        </section>
      </Dim>

      {/* AssignmentsBanner mock — копия AssignmentsBanner.tsx */}
      <Wrap kind="banner">
        <section className="px-4 animate-fadeInDown" style={{ paddingBottom: 15 }}>
          <div
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
      </Wrap>

      {/* TrainingsSection — 3 карточки */}
      <Wrap kind="trainings">
        <section className="px-4" style={{ paddingBottom: 15 }}>
          <div className="grid grid-cols-2 gap-2">
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
                }}
              >
                повышение потенциала
              </div>
            </div>
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
                }}
              >
                треньки, советы профи, разборы
              </div>
            </div>
          </div>
        </section>
      </Wrap>

      {/* TrainersSection mock — копия page.tsx:805-900 (Dim) */}
      <Dim>
        <section>
          <div
            style={{
              width: '100%',
              paddingTop: 24,
              paddingBottom: 0,
              background: 'linear-gradient(180deg, #101530 0%, #060919 100%)',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 16,
              display: 'flex',
            }}
          >
            <div
              style={{
                width: '100%',
                paddingLeft: 16,
                paddingRight: 16,
                justifyContent: 'space-between',
                alignItems: 'center',
                display: 'flex',
              }}
            >
              <div
                style={{
                  color: '#F9F8FE',
                  fontSize: 12,
                  fontFamily: 'Overpass',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  lineHeight: '14.40px',
                  letterSpacing: 0.5,
                }}
              >
                тренеры
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                overflow: 'hidden',
                width: '100%',
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '170px',
                    flexShrink: 0,
                    paddingBottom: 8,
                    background: '#060919',
                    overflow: 'hidden',
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: '170px',
                      height: '170px',
                      background:
                        'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%), #101530',
                      borderRadius: 8,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </Dim>
    </>
  );
}

// ── 2. Главная: фокус на TrainingsSection (3 карточки) ───────────────
// Та же главная, но focal = TrainingsSection. Сдвигаем вверх, чтобы 3
// карточки оказались ближе к центру экрана.
function SlideHomeCards() {
  return (
    <div className="animate-fadeIn" style={{ transform: 'translateY(-360px)' }}>
      <HomePageMock focal="trainings" />
    </div>
  );
}

// ── 3. Та же главная: фокус смещается на AssignmentsBanner ───────────
// Атлет видит ровно тот же экран — переключается только внимание.
// Сдвиг меньше: баннер выше карточек, поэтому центрируется при -140.
function SlideCoachAssignment() {
  return (
    <div className="animate-fadeIn" style={{ transform: 'translateY(-240px)' }}>
      <HomePageMock focal="banner" />
    </div>
  );
}

// ── 4. Календарь (виджет + карточка тренировки) ───────────────────────
// Pixel-perfect mock из src/app/calendar/page.tsx. Структура: header с
// «КАЛЕНДАРЬ» → виджет (focal) → «Сегодня, 13 июня» + «+ Добавить
// видео» → CoachAssignment-карточка + SwipeableWorkoutItem-карточка (Dim).
function SlideCalendar() {
  const days = Array.from({ length: 35 }, (_, i) => i - 5);
  const todayIdx = 12;
  const eventIdxs = [12, 15, 19, 23];
  return (
    <div
      className="animate-fadeIn"
      style={{
        minHeight: '100%',
        background: 'linear-gradient(182.77deg, #101530 69.24%, #060919 97.69%)',
      }}
    >
      {/* Header страницы — копия calendar/page.tsx:253-271 */}
      <header
        className="flex items-center p-4"
        style={{ paddingTop: 16 }}
      >
        <div className="mr-4 text-white/60">
          <Image src="/icons/icon-action-back.svg" alt="" width={24} height={24} />
        </div>
        <h1
          className="text-white uppercase"
          style={{
            fontFamily: 'Overpass',
            fontWeight: 700,
            fontSize: 12,
            lineHeight: '120%',
            letterSpacing: '0.5px',
          }}
        >
          КАЛЕНДАРЬ
        </h1>
      </header>

      <div className="px-4">
        {/* Focal — сам виджет календаря */}
        <Focus>
          <div className="bg-[#101530] rounded-3xl mb-8 animate-slideUp" style={{ overflow: 'hidden' }}>
            <div className="bg-[#445CFF]/20 rounded-2xl p-4">
              {/* Навигация месяцев — реальные ChevronLeft/Right */}
              <div className="flex items-center justify-between mb-6 text-white">
                <div className="p-2 rounded-full">
                  <ChevronLeft size={24} />
                </div>
                <span className="text-[14px] font-bold uppercase tracking-widest">
                  ИЮНЬ, 2026
                </span>
                <div className="p-2 rounded-full">
                  <ChevronRight size={24} />
                </div>
              </div>
              {/* Дни недели — 14px italic */}
              <div className="grid grid-cols-7 gap-1 mb-4 text-center">
                {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((d) => (
                  <div key={d} className="text-[#AEABBB] text-[14px] font-bold italic">
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
                      className="h-10 w-10 flex flex-col items-center justify-center rounded-full relative text-sm font-medium"
                      style={{
                        color: isVisible ? '#F9F8FE' : 'transparent',
                        background: isToday
                          ? '#445CFF'
                          : hasEvent && isVisible
                          ? 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.5) 100%)'
                          : 'transparent',
                      }}
                    >
                      {isVisible ? d : ''}
                      {hasEvent && !isToday && isVisible && (
                        <span
                          className="absolute bottom-1 w-1 h-1 rounded-full"
                          style={{ background: '#445CFF' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Focus>

        {/* «Сегодня, …» + «+ Добавить видео» (Dim) */}
        <Dim>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-sm font-medium">Сегодня, 13 июня</h2>
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: '#2A3045' }}
            >
              <span className="text-[#AEABBB] text-xs font-medium">Добавить видео</span>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#445CFF' }}
              >
                <Plus size={12} className="text-white" />
              </div>
            </div>
          </div>

          {/* CoachAssignment карточка — копия calendar/page.tsx:335-373 */}
          <div
            className="block rounded-2xl overflow-hidden mb-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
              border: '1px solid rgba(161, 255, 74, 0.25)',
            }}
          >
            <div className="p-4 flex gap-3 items-center">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#0d1228] shrink-0">
                <div className="skeleton-loading" style={{ width: '100%', height: '100%' }} />
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
                    marginBottom: 6,
                  }}
                >
                  от тренера · Никита
                </div>
                <div className="text-white text-sm font-semibold leading-tight">
                  Сила ног, уровень 2
                </div>
                <div className="text-[#AEABBB] text-xs mt-1">18 мин</div>
              </div>
            </div>
          </div>

          {/* SwipeableWorkoutItem mock — копия SwipeableWorkoutItem.tsx:101-220 (без swipe-actions) */}
          <div className="relative overflow-hidden rounded-2xl mb-4">
            <div className="absolute inset-0 flex justify-end">
              <div className="w-20 bg-[#35553B] flex flex-col items-center justify-center gap-1">
                <ThumbsUp size={20} className="text-white" />
                <span className="text-white text-[10px] font-medium leading-tight text-center">
                  В<br />избранное
                </span>
              </div>
              <div className="w-20 bg-[#1A2036] flex flex-col items-center justify-center gap-1">
                <Trash2 size={20} className="text-white" />
                <span className="text-white text-[10px] font-medium leading-tight">Удалить</span>
              </div>
            </div>
            <div className="relative bg-[#101530]">
              <div className="flex p-3 gap-4">
                <div className="relative w-32 h-20 rounded-xl overflow-hidden shrink-0 bg-[#0d1228]">
                  <div className="skeleton-loading" style={{ width: '100%', height: '100%' }} />
                  <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
                    <span className="text-white text-[10px] font-medium">18:00</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-700" />
                      <span className="text-white text-xs font-bold uppercase">
                        Никита Власов
                      </span>
                    </div>
                    <span className="text-[#A1FF4A] text-xs font-bold">19:30</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-[#2A3045] rounded px-2 py-1">
                      <span className="text-[#AEABBB] text-[10px] font-medium">Сила</span>
                    </div>
                    <div className="bg-[#2A3045] rounded px-2 py-1">
                      <span className="text-[#AEABBB] text-[10px] font-medium">Без оборудования</span>
                    </div>
                    <div className="bg-[#2A3045] rounded px-2 py-1">
                      <span className="text-[#AEABBB] text-[10px] font-medium">Любитель</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dim>
      </div>
    </div>
  );
}

// ── 5. Прогресс / Потенциал ───────────────────────────────────────────
// Pixel-perfect mock из src/app/profile/page.tsx:
//   Header «Профиль» + edit (Dim) →
//   квадратная карточка аватара с overlay + 3 строки (Dim) →
//   PotentialSection: 2-колонка CharRow + большое кольцо 144px (Focus) →
//   меню-кнопки в стиле white/10 (Dim).
function potentialColorStory(p: number): string {
  if (p <= 0) return '#AEABBB';
  if (p <= 20) return '#FF8C4A';
  if (p <= 50) {
    const t = (p - 20) / 30;
    const g = Math.round(140 + (201 - 140) * t);
    return `rgb(255,${g},74)`;
  }
  if (p < 70) {
    const t = (p - 50) / 20;
    const r = Math.round(255 + (161 - 255) * t);
    const g = Math.round(201 + (255 - 201) * t);
    return `rgb(${r},${g},74)`;
  }
  return '#A1FF4A';
}

interface MockCharRowProps {
  label: string;
  value: number;
  gain?: number;
  insetRight: number;
}

function MockCharRow({ label, value, gain, insetRight }: MockCharRowProps) {
  const display = value.toFixed(1);
  return (
    <div className="flex items-center" style={{ paddingRight: insetRight }}>
      <div
        className="text-white uppercase shrink-0"
        style={{
          fontFamily: 'Overpass, sans-serif',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.5px',
          lineHeight: '100%',
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 8,
          height: 1,
          background:
            'linear-gradient(90deg, rgba(68,92,255,0) 0%, rgba(68,92,255,0.5) 50%, rgba(68,92,255,0.9) 100%)',
          marginLeft: 6,
          marginRight: -1,
        }}
      />
      <div className="relative shrink-0" style={{ width: 56, height: 56, zIndex: 2 }}>
        <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full">
          <circle cx="28" cy="28" r="26" fill="none" stroke="#445CFF" strokeWidth="1.5" opacity="0.7" />
          <circle cx="28" cy="28" r="22" fill="rgba(68,92,255,0.06)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {gain != null && gain > 0 && (
            <span
              style={{
                color: '#A1FF4A',
                fontWeight: 700,
                fontSize: 9,
                lineHeight: '100%',
                marginBottom: 1,
              }}
            >
              +{gain.toFixed(1)}
            </span>
          )}
          <span
            style={{
              color: '#445CFF',
              fontWeight: 900,
              fontSize: 16,
              lineHeight: '100%',
            }}
          >
            {display}
          </span>
        </div>
      </div>
    </div>
  );
}

function MockPotentialSection() {
  const p = 54;
  const ringColor = potentialColorStory(p);
  const RING_SIZE = 144;
  const RING_RADIUS = 60;
  const RING_INNER_RADIUS = 52;
  const RING_OUTER_RADIUS = 68;
  const DOTS_RADIUS = 72;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;
  const DOT_COUNT = 10;
  const dots = Array.from({ length: DOT_COUNT }, (_, i) => {
    const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2;
    return {
      x: RING_SIZE / 2 + DOTS_RADIUS * Math.cos(angle),
      y: RING_SIZE / 2 + DOTS_RADIUS * Math.sin(angle),
      key: i,
    };
  });

  const rows: MockCharRowProps[] = [
    { label: 'выносливость', value: 5.2, gain: 0.4, insetRight: 0 },
    { label: 'техника', value: 5.8, insetRight: 24 },
    { label: 'сила', value: 6.1, gain: 0.3, insetRight: 40 },
    { label: 'скорость', value: 4.7, insetRight: 24 },
    { label: 'гибкость', value: 4.0, insetRight: 0 },
  ];

  return (
    <div
      className="relative"
      style={{ backgroundColor: '#060919', borderRadius: 12, padding: '18px 16px' }}
    >
      <div className="flex items-stretch gap-2">
        <div
          className="flex-1 flex flex-col justify-between"
          style={{ minHeight: RING_SIZE + 32, gap: 10 }}
        >
          {rows.map((r) => (
            <MockCharRow key={r.label} {...r} />
          ))}
        </div>
        <div
          className="relative shrink-0 self-center"
          style={{ width: RING_SIZE, height: RING_SIZE, zIndex: 1 }}
        >
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_OUTER_RADIUS} fill="none" stroke={ringColor} strokeWidth="1" opacity="0.35" />
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_INNER_RADIUS} fill="none" stroke={ringColor} strokeWidth="1" opacity="0.35" />
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="#1F2540" strokeWidth="6" />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(p / 100) * RING_CIRC} ${RING_CIRC}`}
            />
          </svg>
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {dots.map((d) => (
              <circle key={d.key} cx={d.x} cy={d.y} r={2} fill={ringColor} opacity={0.55} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              style={{ color: ringColor, fontWeight: 900, fontSize: 32, lineHeight: '100%' }}
            >
              {p.toFixed(1)}
            </div>
            <div
              className="uppercase italic mt-1 text-center"
              style={{
                color: '#F9F8FE',
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.5px',
                lineHeight: '110%',
              }}
            >
              общий<br />потенциал
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideProgress() {
  // Сдвигаем содержимое вверх: header «Профиль» + большая квадратная карточка
  // аватара уезжают за верх, focal-блок PotentialSection поднимается к центру.
  return (
    <div className="animate-fadeIn" style={{ transform: 'translateY(-440px)' }}>
      {/* Header страницы «Профиль» — копия profile/page.tsx:455-474 (Dim) */}
      <Dim>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-white uppercase"
              style={{
                fontFamily: 'Overpass',
                fontWeight: 700,
                fontSize: 12,
                lineHeight: '120%',
                letterSpacing: '0.5px',
              }}
            >
              Профиль
            </h1>
          </div>
          <div className="w-6 h-6 flex items-center justify-center">
            <Image src="/icons/icon-edit.svg" alt="" width={24} height={24} />
          </div>
        </div>
      </Dim>

      <div className="px-4 flex flex-col gap-6">
        {/* Карточка аватара — копия profile/page.tsx:481-544 (Dim) */}
        <Dim>
          <div className="bg-[#060919] rounded-lg overflow-hidden">
            <div className="w-full relative" style={{ aspectRatio: '1 / 1' }}>
              {/* Заглушка аватара (без реального файла, чтобы не падал Image) */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(135deg, #1a2148 0%, #060919 70%, #101530 100%)',
                }}
              />
              {/* Номер и позиция — левый верхний */}
              <div
                className="absolute top-3 left-3 w-16 h-16 rounded-lg flex flex-col items-center justify-center"
                style={{ background: '#445CFF' }}
              >
                <div className="text-white text-2xl font-black leading-none">10</div>
                <div className="text-white text-xs font-medium uppercase leading-none mt-1">
                  ЦН
                </div>
              </div>
              {/* Логотип клуба — правый верхний */}
              <div className="absolute top-3 right-3 w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                <Image
                  src="/icons/icon-app.svg"
                  alt=""
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="h-10 px-4 flex items-center border-b border-[#26252F]">
              <div className="text-[#445CFF] text-base font-medium uppercase">БАХТИЯР</div>
            </div>
            <div className="h-10 px-4 flex items-center border-b border-[#26252F]">
              <div className="text-[#445CFF] text-base font-medium uppercase">МИНГАЗОВ</div>
            </div>
            <div className="h-10 px-4 flex items-center">
              <div className="text-[#AEABBB] text-sm font-medium uppercase">
                17 ЛЕТ | 178 СМ | 72 КГ
              </div>
            </div>
          </div>
        </Dim>

        {/* PotentialSection — focal */}
        <Focus>
          <div className="animate-popIn">
            <MockPotentialSection />
          </div>
        </Focus>

        {/* Меню-кнопки — реальный стиль white/10 (Dim) */}
        <Dim>
          <div className="bg-[#060919] rounded-lg px-4">
            {[
              'Задания от тренера',
              'Вступить в команду',
              'Уведомления',
              'Выйти',
            ].map((label, i, arr) => (
              <div
                key={label}
                className="flex justify-between items-center py-4"
                style={{
                  borderBottom: i < arr.length - 1 ? '1px solid #26252F' : undefined,
                }}
              >
                <span className="text-white text-sm font-medium uppercase tracking-wide">
                  {label}
                </span>
                <Image src="/icons/arrow.svg" alt="" width={20} height={20} className="opacity-50" />
              </div>
            ))}
          </div>
        </Dim>
      </div>
    </div>
  );
}

// ── 6. ИИ-тренер: цикл на неделю готов (CTA-слайд) ────────────────────
// Финальный кадр сторис. Функционал «недельного цикла» появится позже —
// сейчас просто визуальный teaser: 7 дней (Dim) + карточка с подписью и
// большая лайм-кнопка (Focus) приглашают начать.
function SlideAIWeekCycle() {
  const days = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
  return (
    <div className="animate-fadeIn" style={{ paddingTop: 40 }}>
      <div
        className="font-overpass uppercase"
        style={{
          color: '#A1FF4A',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.5px',
          paddingLeft: 16,
          marginBottom: 12,
        }}
      >
        ИИ-тренер
      </div>

      {/* 7 дней недели — Dim */}
      <Dim>
        <section className="px-4 mb-5">
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <div
                  style={{
                    color: '#AEABBB',
                    fontSize: 11,
                    fontWeight: 700,
                    fontStyle: 'italic',
                  }}
                >
                  {d}
                </div>
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1.4',
                    borderRadius: 6,
                    background:
                      i === 6
                        ? 'rgba(174, 171, 187, 0.10)'
                        : i % 2 === 0
                        ? 'rgba(68, 92, 255, 0.20)'
                        : 'rgba(161, 255, 74, 0.15)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </Dim>

      {/* Focal — карточка с описанием + большая кнопка */}
      <Focus>
        <section className="px-4">
          <div
            className="animate-popIn"
            style={{
              background: '#060919',
              border: '1px solid rgba(161, 255, 74, 0.25)',
              borderRadius: 16,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: 'rgba(161, 255, 74, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/icons/ant-design-thunderbolt-filled_f.svg"
                  alt=""
                  width={20}
                  height={20}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-overpass uppercase"
                  style={{
                    color: '#A1FF4A',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    marginBottom: 4,
                  }}
                >
                  цикл на неделю готов
                </div>
                <div
                  className="font-overpass"
                  style={{
                    color: '#F9F8FE',
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: '130%',
                  }}
                >
                  Подобран под твоё состояние и расписание. Осталось нажать кнопку.
                </div>
              </div>
            </div>

            <div
              className="w-full"
              style={{
                background: '#A1FF4A',
                color: '#060919',
                padding: '16px 24px',
                borderRadius: 32,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                fontFamily: 'Overpass',
                textAlign: 'center',
              }}
            >
              запустить неделю
            </div>
          </div>
        </section>
      </Focus>
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
    visual: <SlideProgress />,
  },
  {
    title: 'ИИ-тренер уже всё собрал',
    body: 'Недельный цикл готов — подобран под твоё состояние, прокачку и расписание. Осталось нажать «Поехали».',
    cta: 'Поехали',
    visual: <SlideAIWeekCycle />,
  },
];

// =====================================================================
//                            КОМПОНЕНТ
// =====================================================================

export default function OnboardingStories({ open, onClose, onComplete }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  // Лоадер пока выполняется onComplete (например, идёт генерация микроцикла).
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
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
            <>
              <button
                type="button"
                disabled={completing}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={async (e) => {
                  e.stopPropagation();
                  if (pointerRef.current?.holdTimer != null) clearTimeout(pointerRef.current.holdTimer);
                  pointerRef.current = null;

                  if (!onComplete) {
                    close();
                    return;
                  }

                  // Передан handler (реальная генерация микроцикла + редирект).
                  // Пока он работает — показываем лоадер, прогресс ставим на паузу.
                  setCompleteError(null);
                  setCompleting(true);
                  setPaused(true);
                  try {
                    await onComplete();
                    // Закрывать здесь не нужно — onComplete сам редиректит
                    // (страница размонтируется).
                  } catch (err: any) {
                    setCompleteError(err?.message || 'Не удалось подготовить твою неделю. Попробуй ещё раз.');
                    setCompleting(false);
                    setPaused(false);
                  }
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
                  cursor: completing ? 'wait' : 'pointer',
                  width: '100%',
                  opacity: completing ? 0.65 : 1,
                }}
              >
                {completing ? 'Готовим твою неделю…' : current.cta}
              </button>
              {completeError && (
                <div
                  className="font-overpass mt-3 text-center"
                  style={{ color: '#FF8C4A', fontSize: 12 }}
                >
                  {completeError}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
