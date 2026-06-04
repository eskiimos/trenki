'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Сторис-онбординг в стиле Instagram. Пока что доступен только из админ-
 * профиля по кнопке (feature-flag). Когда дизайн утвердят — будет
 * автоматически открываться один раз после прохождения онбординга.
 *
 * Управление:
 *   • тап слева — назад
 *   • тап справа — вперёд
 *   • удержание — пауза прогресса
 *   • свайп вниз — закрыть
 *   • ✕ — закрыть
 *   • автопереход через STORY_DURATION_MS
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

const STORY_DURATION_MS = 5500;

interface Slide {
  /** Цветовой акцент конкретно для этого слайда (фон heading-капсулы и т.п.) */
  accent: string;
  /** Заголовок */
  title: string;
  /** Подпись под заголовком */
  body: string;
  /** Превью-блок (рендерится в верхней части слайда) */
  visual: React.ReactNode;
  /** CTA для последнего слайда (опционально). При клике вызывается onClose. */
  cta?: string;
}

function PreviewCard({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  // Полупрозрачная mock-карточка в стиле приложения. Не интерактивная.
  return (
    <div
      style={{
        background: '#101530',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '14px 16px',
        transform: `scale(${scale})`,
        transformOrigin: 'top center',
      }}
    >
      {children}
    </div>
  );
}

function SkeletonBar({ width, height = 12 }: { width: string; height?: number }) {
  return (
    <div
      className="skeleton-loading"
      style={{ width, height, borderRadius: 4, marginBottom: 8 }}
    />
  );
}

const SLIDES: Slide[] = [
  // 1 — приветствие
  {
    accent: '#A1FF4A',
    title: 'Привет в Треньках!',
    body: 'Цифровая среда для хоккеистов: персональные тренировки, разборы профи и работа с твоим тренером.',
    visual: (
      <div
        className="flex flex-col items-center justify-center"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(161, 255, 74, 0.18) 0%, transparent 60%)',
          height: '100%',
          paddingTop: 80,
        }}
      >
        <div
          className="font-overpass uppercase animate-popIn"
          style={{
            color: '#F9F8FE',
            fontSize: 52,
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
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4em',
            animationDelay: '0.15s',
          }}
        >
          для хоккеиста
        </div>
      </div>
    ),
  },
  // 2 — ИИ-тренер
  {
    accent: '#A1FF4A',
    title: 'Персональный ИИ-тренер',
    body: 'Скажи, как ты себя чувствуешь и над чем хочешь поработать — мы соберём тренировку под тебя за секунды.',
    visual: (
      <div className="flex flex-col gap-3 px-2 pt-4 animate-slideUp">
        <PreviewCard>
          <div
            className="font-overpass uppercase"
            style={{ color: '#A1FF4A', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px' }}
          >
            твоё состояние
          </div>
          <div className="flex gap-2 mt-3">
            <div
              className="font-overpass uppercase flex-1 text-center"
              style={{
                background: 'rgba(161, 255, 74, 0.2)',
                color: '#AEABBB',
                padding: '8px 0',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              в тонусе
            </div>
            <div
              className="font-overpass uppercase flex-1 text-center"
              style={{
                background: '#A1FF4A',
                color: '#101530',
                padding: '8px 0',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              полон сил
            </div>
            <div
              className="font-overpass uppercase flex-1 text-center"
              style={{
                background: 'transparent',
                color: '#AEABBB',
                border: '1px solid #26252F',
                padding: '7px 0',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              устал
            </div>
          </div>
        </PreviewCard>
        <PreviewCard>
          <div
            className="font-overpass uppercase"
            style={{ color: '#A1FF4A', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px' }}
          >
            цель
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {['Скорость', 'Бросок', 'Выносливость', 'Техника'].map((c, i) => (
              <div
                key={c}
                className="font-overpass uppercase"
                style={{
                  background: i === 1 ? '#A1FF4A' : 'transparent',
                  color: i === 1 ? '#101530' : '#AEABBB',
                  border: i === 1 ? 'none' : '1px solid #26252F',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </PreviewCard>
      </div>
    ),
  },
  // 3 — тренировки от тренера
  {
    accent: '#A1FF4A',
    title: 'Тренировки от твоего тренера',
    body: 'Тренер назначает тебе задание — оно само появится в календаре и напомнит за 30 и 10 минут до старта.',
    visual: (
      <div className="px-2 pt-6 animate-slideUp">
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(161, 255, 74, 0.12) 0%, rgba(68, 92, 255, 0.20) 100%)',
            border: '1px solid rgba(161, 255, 74, 0.25)',
            borderRadius: 14,
            padding: '16px 18px',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="font-overpass uppercase"
                style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 800, letterSpacing: '0.5px' }}
              >
                от тренера
              </div>
              <div
                className="font-overpass mt-2"
                style={{ color: '#F9F8FE', fontSize: 16, fontWeight: 800 }}
              >
                <span style={{ color: '#A1FF4A' }}>3</span> тренировки ждут
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'rgba(161, 255, 74, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#A1FF4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
        <PreviewCard>
          <div className="flex gap-3">
            <div
              className="skeleton-loading shrink-0"
              style={{ width: 76, height: 44, borderRadius: 6 }}
            />
            <div className="flex-1">
              <SkeletonBar width="80%" height={12} />
              <SkeletonBar width="55%" height={10} />
            </div>
          </div>
        </PreviewCard>
      </div>
    ),
  },
  // 4 — каталог видео + offline
  {
    accent: '#A1FF4A',
    title: 'Большой каталог видео',
    body: 'Разминки, ОФП, техника, заминка — всё с лучшими тренерами. Скачивай для оффлайн просмотра на сборах.',
    visual: (
      <div className="pt-6 px-2 animate-fadeIn">
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="shrink-0"
              style={{
                width: '60%',
                aspectRatio: '16/9',
                borderRadius: 10,
                background:
                  i === 0
                    ? 'linear-gradient(135deg, #1a2148 0%, #060919 100%)'
                    : 'linear-gradient(135deg, #101530 0%, #060919 100%)',
                position: 'relative',
                opacity: i === 0 ? 1 : 0.55,
                transform: `translateX(${-i * 8}px)`,
              }}
            >
              <div
                className="absolute"
                style={{
                  right: 6,
                  bottom: 6,
                  background: 'rgba(6, 9, 25, 0.85)',
                  color: '#F9F8FE',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                12 мин
              </div>
            </div>
          ))}
        </div>
        <div
          className="font-overpass mt-5"
          style={{
            color: '#A1FF4A',
            fontSize: 12,
            fontWeight: 800,
            textAlign: 'center',
            background: 'rgba(161, 255, 74, 0.10)',
            border: '1px solid rgba(161, 255, 74, 0.30)',
            borderRadius: 999,
            padding: '8px 12px',
            display: 'inline-block',
          }}
        >
          ⬇ Скачано · Работает без сети
        </div>
      </div>
    ),
  },
  // 5 — прогресс / финал
  {
    accent: '#A1FF4A',
    title: 'Растёшь с каждой тренировкой',
    body: 'Сила, скорость, техника, выносливость и гибкость — следи как растёт твой потенциал.',
    cta: 'Поехали',
    visual: (
      <div className="pt-6 px-2 animate-popIn">
        <PreviewCard>
          <div
            className="font-overpass uppercase"
            style={{ color: '#A1FF4A', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px' }}
          >
            твой потенциал
          </div>
          <div
            className="font-overpass mt-2"
            style={{ color: '#F9F8FE', fontSize: 32, fontWeight: 900, lineHeight: 1 }}
          >
            <span style={{ color: '#A1FF4A' }}>+8</span>
            <span style={{ color: '#AEABBB', fontSize: 14, marginLeft: 8 }}>за неделю</span>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {[
              { label: 'Сила', val: 68 },
              { label: 'Скорость', val: 54 },
              { label: 'Выносливость', val: 47 },
              { label: 'Техника', val: 61 },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex justify-between font-overpass" style={{ fontSize: 11 }}>
                  <span style={{ color: '#AEABBB' }}>{r.label}</span>
                  <span style={{ color: '#F9F8FE', fontWeight: 800 }}>{r.val}</span>
                </div>
                <div style={{ background: '#1a1f3a', borderRadius: 999, height: 5, marginTop: 4 }}>
                  <div
                    style={{
                      width: `${r.val}%`,
                      height: '100%',
                      background: '#A1FF4A',
                      borderRadius: 999,
                      transition: 'width 0.8s ease-out',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PreviewCard>
      </div>
    ),
  },
];

export default function OnboardingStories({ open, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // progress 0..1, обновляется на animationframe пока не paused
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  const total = SLIDES.length;
  const current = SLIDES[idx];

  // Сброс прогресса + переход на следующий слайд
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

  // На последнем слайде по завершении прогресса — оставляем экран до явного закрытия.
  // На остальных — auto-advance.
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

  // Блокируем body scroll
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    setPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    setPaused(false);
    const startY = touchStartYRef.current;
    touchStartYRef.current = null;
    if (startY === null) return;
    const endY = e.changedTouches[0].clientY;
    if (endY - startY > 80) {
      // свайп вниз
      close();
    }
  };

  const handleLeftTap = () => {
    if (idx > 0) prev();
    // На первом слайде тап слева — игнорируем (не закрываем, чтобы не запутать)
  };

  const handleRightTap = () => {
    if (idx + 1 < total) next();
    else close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#060919',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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

      {/* Закрыть */}
      <button
        type="button"
        onClick={close}
        aria-label="Закрыть"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          right: 14,
          width: 32,
          height: 32,
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

      {/* Контент текущего слайда (фон + визуал) */}
      <div
        key={idx}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(circle at 50% 0%, rgba(68, 92, 255, 0.18) 0%, rgba(6, 9, 25, 0) 60%), #060919',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="animate-fadeIn"
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          {current.visual}
        </div>

        {/* Текст + (CTA если есть) */}
        <div
          className="px-6 pb-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)' }}
        >
          <div
            className="font-overpass uppercase"
            style={{
              color: current.accent,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.4em',
              marginBottom: 8,
            }}
          >
            треньки · {idx + 1}/{total}
          </div>
          <h2
            className="font-overpass"
            style={{
              color: '#F9F8FE',
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 10,
            }}
          >
            {current.title}
          </h2>
          <p
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.45 }}
          >
            {current.body}
          </p>

          {current.cta && (
            <button
              type="button"
              onClick={close}
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

      {/* Тап-зоны: слева — назад, справа — вперёд. Поверх контента, но прозрачные. */}
      <button
        type="button"
        aria-label="Назад"
        onClick={handleLeftTap}
        style={{
          position: 'absolute',
          inset: '60px 0 100px 0',
          left: 0,
          width: '30%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          zIndex: 2,
        }}
      />
      <button
        type="button"
        aria-label="Вперёд"
        onClick={handleRightTap}
        style={{
          position: 'absolute',
          inset: '60px 0 100px 0',
          right: 0,
          width: '30%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          zIndex: 2,
        }}
      />
    </div>
  );
}
