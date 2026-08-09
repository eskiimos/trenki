'use client';

// Модалка «Ачивки» — открывается тапом по бейджу темпа в профиле. Сам грузит
// свои ачивки с /api/gamification/achievements при первом открытии (эндпоинт
// работает только для текущего юзера, поэтому prop не нужен). Стиль — как
// StatusPathModal: overlay, #0B1030, лаймовая рамка, popIn, Escape/оверлей.

import { useEffect, useState } from 'react';

interface AchievementItem {
  key: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress: { current: number; target: number };
}

interface AchievementsData {
  achievements: AchievementItem[];
  unlockedCount: number;
  total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const AchievementsModal = ({ open, onClose }: Props) => {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [failed, setFailed] = useState(false);

  // Escape закрывает модалку (только пока она открыта)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Ленивая загрузка при первом открытии; данные кэшируем на жизнь страницы —
  // ачивки меняются только после завершения тренировки.
  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    setFailed(false);
    fetch('/api/gamification/achievements')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.achievements)) setData(d);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      style={{
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Ачивки"
      onClick={onClose}
    >
      <div
        className="animate-popIn w-full max-w-sm rounded-2xl p-6 max-h-full overflow-y-auto"
        style={{ background: '#0B1030', border: '1px solid rgba(161, 255, 74, 0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-xl font-bold text-center mb-5">
          {data ? `Ачивки (${data.unlockedCount}/${data.total})` : 'Ачивки'}
        </div>

        {!data && !failed && (
          <div className="text-muted text-sm text-center py-8">Загрузка…</div>
        )}
        {failed && (
          <div className="text-muted text-sm text-center py-8">
            Не удалось загрузить ачивки. Попробуй позже.
          </div>
        )}

        {data && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {data.achievements.map((a) => {
              // Мини-прогрессбар только у счётчиковых и только пока не получена
              const showBar = !a.unlocked && a.progress.target > 1;
              return (
                <div
                  key={a.key}
                  className={`rounded-xl px-1.5 py-2.5 text-center flex flex-col items-center ${
                    a.unlocked
                      ? 'bg-brand/10 border border-brand/40'
                      : 'bg-white/[0.03] border border-white/10 opacity-60'
                  }`}
                >
                  <span
                    className={`text-2xl leading-none mb-1.5 ${a.unlocked ? '' : 'grayscale'}`}
                    aria-hidden
                  >
                    {a.emoji}
                  </span>
                  <div
                    className={`text-[11px] font-bold leading-tight ${
                      a.unlocked ? 'text-brand' : 'text-white'
                    }`}
                  >
                    {a.title}
                  </div>
                  {!a.unlocked && (
                    <div className="text-muted text-[9px] leading-tight mt-0.5">
                      {a.description}
                    </div>
                  )}
                  {showBar && (
                    <div className="w-full mt-1.5">
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand/70"
                          style={{
                            width: `${Math.round((a.progress.current / a.progress.target) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-muted text-[9px] mt-0.5">
                        {a.progress.current}/{a.progress.target}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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

export default AchievementsModal;
