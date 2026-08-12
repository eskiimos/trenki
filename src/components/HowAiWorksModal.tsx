'use client';

// Короткое объяснение «как работает ИИ-тренер» (Sprint 3). Самодостаточный
// компонент: маленькая ссылка-триггер + модалка. Текст правдиво описывает логику
// подбора (цель + энергия + характеристики → модули нужной нагрузки).

import { useState } from 'react';
import { Target, BarChart3, Blocks, Zap, type LucideIcon } from 'lucide-react';

const STEPS: { Icon: LucideIcon; title: string; text: string }[] = [
  {
    Icon: Target,
    title: 'Ты задаёшь цель и состояние',
    text: 'Выбираешь, что качаем (например «убежать от соперника» — скорость), и как себя чувствуешь сегодня — уровень энергии.',
  },
  {
    Icon: BarChart3,
    title: 'ИИ смотрит на твой профиль',
    text: 'Учитывает твои характеристики — силу, скорость, технику, выносливость, гибкость — и что уже прокачано, а что отстаёт.',
  },
  {
    Icon: Blocks,
    title: 'Собирает тренировку под тебя',
    text: 'Подбирает модули нужной нагрузки: разминка → основная часть → заминка. Не перегружает и закрывает слабые места.',
  },
  {
    Icon: Zap,
    title: 'Растёшь с каждой тренировкой',
    text: 'Каждое занятие даёт XP и поднимает характеристики. Три дня подряд включают «Ударный темп ×2».',
  },
];

export default function HowAiWorksModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#AEABBB',
          fontFamily: 'Overpass, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: '2px 0',
        }}
      >
        Как это работает?
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 70,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#101530',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '24px 20px calc(env(safe-area-inset-bottom) + 24px)',
              width: '100%', maxWidth: 480,
              fontFamily: 'Overpass, sans-serif',
              maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Как работает ИИ-тренер
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                style={{ background: 'none', border: 'none', color: '#AEABBB', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}><s.Icon size={22} color="#A1FF4A" aria-hidden /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#F9F8FE', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{s.title}</div>
                    <div style={{ color: '#AEABBB', fontSize: 13, lineHeight: '150%' }}>{s.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: '100%', height: 52, marginTop: 24, borderRadius: 999,
                backgroundColor: '#A1FF4A', color: '#060919', fontWeight: 700, fontSize: 16,
                border: 'none', cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
