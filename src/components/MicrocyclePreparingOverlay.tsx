'use client';

// Полноэкранный лоадер «Готовим твою неделю» — показывается, пока
// POST /api/microcycle/generate отрабатывает (5-15с). Вместо абстрактного
// прогресса рисуем волну недельной нагрузки в стиле логотипа: 5 дней на своих
// высотах (Заряжен=4, В тонусе=3, Устал=2, Разминка/Растяжка=1). Линия
// «рисуется», подписи появляются по очереди — создаёт ощущение, что ИИ
// действительно собирает неделю.

import MicrocycleWave from '@/components/MicrocycleWave';

interface Props {
  open: boolean;
}

export default function MicrocyclePreparingOverlay({ open }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 animate-fadeIn"
      style={{
        background:
          'radial-gradient(circle at 50% 30%, rgba(161, 255, 74, 0.16) 0%, transparent 55%), #060919',
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
          marginBottom: 28,
          maxWidth: 320,
        }}
      >
        Подбираем 5 тренировок под твои характеристики
      </p>

      {/* Волна недельной нагрузки */}
      <MicrocycleWave />

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
        @keyframes microcyclePulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
