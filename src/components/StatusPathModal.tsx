'use client';

// Модалка «Путь хоккеиста» — открывается тапом по бейджу статуса (профиль,
// родительский кабинет) и показывает всю лестницу званий из STATUSES:
// пройденные (✓, приглушены), текущее («ты здесь», лайм) и будущие
// (следующее — с акцентом и счётчиком оставшихся уровней).

import { useEffect } from 'react';
import {
  STATUSES,
  XP_PER_COMPLETED_MODULE,
  XP_PER_COMPLETED_WORKOUT,
} from '@/lib/gamification';

interface Props {
  currentLevel: number;
  open: boolean;
  onClose: () => void;
}

const StatusPathModal = ({ currentLevel, open, onClose }: Props) => {
  // Escape закрывает модалку (только пока она открыта)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Текущий статус — последний с minLevel <= currentLevel (как statusFromLevel)
  let currentIdx = 0;
  STATUSES.forEach((s, i) => {
    if (currentLevel >= s.minLevel) currentIdx = i;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      style={{
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Путь хоккеиста"
      onClick={onClose}
    >
      <div
        className="animate-popIn w-full max-w-sm rounded-2xl p-6 max-h-full overflow-y-auto"
        style={{ background: '#0B1030', border: '1px solid rgba(161, 255, 74, 0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-xl font-bold text-center mb-5">Путь хоккеиста</div>

        {/* Вертикальная лестница всех званий */}
        <ol className="space-y-1.5 mb-5">
          {STATUSES.map((s, i) => {
            const passed = i < currentIdx;
            const current = i === currentIdx;
            const isNext = i === currentIdx + 1;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  current ? 'bg-brand/15 border border-brand/40' : ''
                }${passed ? ' opacity-45' : ''}`}
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  {s.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${current ? 'text-brand' : 'text-white'}`}>
                    {s.title}
                  </div>
                  <div className="text-muted text-xs">
                    {i === 0 ? 'старт' : `с ${s.minLevel} уровня`}
                  </div>
                </div>
                {passed && (
                  <span className="text-muted text-sm shrink-0" aria-hidden>
                    ✓
                  </span>
                )}
                {current && (
                  <span className="text-brand text-[11px] font-bold font-overpass uppercase shrink-0">
                    ты здесь
                  </span>
                )}
                {isNext && (
                  <div className="text-right shrink-0">
                    <div className="text-white text-[11px] font-bold font-overpass uppercase">
                      следующее звание
                    </div>
                    <div className="text-muted text-[11px]">
                      осталось {s.minLevel - currentLevel} ур.
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <p className="text-muted/70 text-[11px] text-center leading-relaxed mb-4">
          Уровни растут за тренировки: тренировка +{XP_PER_COMPLETED_WORKOUT} XP, модуль +
          {XP_PER_COMPLETED_MODULE}. 🔥 Серия от 3 дней подряд — ударный темп: весь опыт дня ×2
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-brand text-night font-bold font-overpass uppercase rounded-full py-3 transition-transform active:scale-95"
        >
          Понятно
        </button>
      </div>
    </div>
  );
};

export default StatusPathModal;
