'use client';

// Полноэкранный лоадер, который показывается пока POST /api/microcycle/generate
// отрабатывает на сервере. Бэкенд делает 5 buildWorkout последовательно —
// это занимает 5-15 секунд, и без визуального прогресса кажется, что
// приложение зависло.
//
// Анимация: 5 карточек дней (Пн-Пт условно — реальные intent'ы)
// последовательно «заполняются» зелёным с интервалом ~2.4с (соответствует
// средней длительности одного buildWorkout). Между заполнениями — шиммер.
// Не блокируется и не зависит от реального прогресса бэкенда (его нет),
// просто создаёт ощущение пошагового выполнения.

import { useEffect, useState } from 'react';

const STEPS = [
  { emoji: '⚡️', label: 'В тонусе' },
  { emoji: '🏃', label: 'Разминка' },
  { emoji: '🔋', label: 'Заряжен' },
  { emoji: '🧘', label: 'Растяжка' },
  { emoji: '😴', label: 'Устал' },
];

const STEP_INTERVAL_MS = 2400; // ~12с на 5 шагов

interface Props {
  open: boolean;
}

export default function MicrocyclePreparingOverlay({ open }: Props) {
  // filledCount: сколько карточек уже «готово» (заполнены зелёным).
  // Идём 0..5; на 5 застываем — реальный API всё ещё может работать.
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setFilledCount(0);
      return;
    }
    // Стартуем с первого шага сразу после монтирования.
    setFilledCount(1);
    const interval = setInterval(() => {
      setFilledCount((c) => Math.min(c + 1, STEPS.length));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 animate-fadeIn"
      style={{
        background:
          'radial-gradient(circle at 50% 30%, rgba(161, 255, 74, 0.20) 0%, transparent 55%), #060919',
      }}
    >
      <div
        className="font-overpass uppercase text-center"
        style={{
          color: '#A1FF4A',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.5px',
          marginBottom: 12,
        }}
      >
        ИИ-тренер
      </div>
      <h2
        className="font-overpass uppercase text-center"
        style={{
          color: '#F9F8FE',
          fontSize: 22,
          fontWeight: 900,
          lineHeight: '120%',
          letterSpacing: '0.02em',
          marginBottom: 8,
        }}
      >
        Готовим твою неделю
      </h2>
      <p
        className="font-overpass text-center"
        style={{
          color: '#AEABBB',
          fontSize: 13,
          lineHeight: 1.45,
          marginBottom: 32,
          maxWidth: 320,
        }}
      >
        Подбираем 5 тренировок под твои характеристики
      </p>

      <div className="flex gap-2 w-full max-w-md" style={{ minHeight: 96 }}>
        {STEPS.map((s, i) => {
          const isFilled = i < filledCount;
          const isActive = i === filledCount - 1;
          return (
            <div
              key={s.label}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-2xl"
              style={{
                aspectRatio: '0.65 / 1',
                background: isFilled
                  ? 'rgba(161, 255, 74, 0.18)'
                  : 'rgba(174, 171, 187, 0.06)',
                border: `1px solid ${isFilled ? 'rgba(161, 255, 74, 0.5)' : 'rgba(174, 171, 187, 0.15)'}`,
                transition: 'background 0.6s ease, border 0.6s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  opacity: isFilled ? 1 : 0.35,
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                }}
              >
                {s.emoji}
              </div>
              <div
                className="font-overpass uppercase text-center"
                style={{
                  color: isFilled ? '#F9F8FE' : '#AEABBB',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  lineHeight: '110%',
                  padding: '0 2px',
                  transition: 'color 0.4s ease',
                }}
              >
                {s.label}
              </div>
              {isActive && (
                // Шиммер на текущем активном шаге
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(105deg, transparent 30%, rgba(161, 255, 74, 0.18) 50%, transparent 70%)',
                    animation: 'microcycleShimmer 1.4s linear infinite',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Прогресс-точки внизу */}
      <div className="flex gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: '#A1FF4A',
              animation: `microcyclePulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes microcycleShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes microcyclePulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
