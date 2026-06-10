'use client';

// Визуальный слой тура: затемнение всего экрана с «дыркой» вокруг целевого
// элемента (spotlight) + карточка-подсказка (tooltip). Использует палитру
// и приёмы из OnboardingStories (лаймовое свечение focal, прогресс-полоски).
//
// Spotlight сделан четырьмя затемняющими div'ами вокруг прямоугольника цели
// (а не SVG-маской) — так «дырка» остаётся реально кликабельной (клик
// проходит к живому элементу для шагов advanceOn='tap'), а затемнённые
// области перехватывают клики мимо.

import { TourStep } from './types';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  step: TourStep;
  rect: Rect | null; // null → центрированный фолбэк (элемент не найден)
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}

const DIM = 'rgba(6, 9, 25, 0.82)';
const PAD = 8;

export default function TourOverlay({ step, rect, index, total, onNext, onSkip }: Props) {
  const isLast = !!step.isLast;
  const isTap = step.advanceOn === 'tap';

  // Позиция тултипа: если цель в нижней половине экрана — показываем над ней,
  // иначе под ней. Без цели — по центру.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const tooltipBelow = rect ? rect.top + rect.height < vh * 0.55 : true;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
      {/* Затемнение */}
      {rect ? (
        <>
          {/* top */}
          <div style={dimStyle(0, 0, '100vw', Math.max(0, rect.top - PAD))} onClick={onSkipGuard(isTap, onSkip)} />
          {/* bottom */}
          <div
            style={dimStyle(
              rect.top + rect.height + PAD,
              0,
              '100vw',
              `calc(100vh - ${rect.top + rect.height + PAD}px)`,
            )}
            onClick={onSkipGuard(isTap, onSkip)}
          />
          {/* left */}
          <div
            style={dimStyle(rect.top - PAD, 0, Math.max(0, rect.left - PAD), rect.height + PAD * 2)}
            onClick={onSkipGuard(isTap, onSkip)}
          />
          {/* right */}
          <div
            style={dimStyle(
              rect.top - PAD,
              rect.left + rect.width + PAD,
              `calc(100vw - ${rect.left + rect.width + PAD}px)`,
              rect.height + PAD * 2,
            )}
            onClick={onSkipGuard(isTap, onSkip)}
          />
          {/* Свечение-рамка вокруг цели */}
          <div
            style={{
              position: 'fixed',
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              border: '2px solid #A1FF4A',
              borderRadius: 14,
              boxShadow: '0 0 0 2px rgba(161,255,74,0.25), 0 0 28px rgba(161,255,74,0.35)',
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
              animation: isTap ? 'tourPulse 1.6s ease-in-out infinite' : undefined,
            }}
          />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: DIM }} />
      )}

      {/* Тултип */}
      <div
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          ...(rect
            ? tooltipBelow
              ? { top: Math.min(rect.top + rect.height + PAD + 14, vh - 220) }
              : { top: Math.max(rect.top - PAD - 14 - 200, 16) }
            : { top: '50%', transform: 'translateY(-50%)' }),
          zIndex: 9999,
          background: '#101530',
          border: '1px solid rgba(161,255,74,0.25)',
          borderRadius: 16,
          padding: 18,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          maxWidth: 460,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {/* Прогресс */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= index ? '#A1FF4A' : 'rgba(255,255,255,0.18)',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>

        <div
          className="font-overpass uppercase"
          style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', marginBottom: 6 }}
        >
          {step.title}
        </div>
        <div
          className="font-overpass"
          style={{ color: '#F9F8FE', fontSize: 14, fontWeight: 500, lineHeight: 1.45, marginBottom: 14 }}
        >
          {step.body}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button
            type="button"
            onClick={onSkip}
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            Пропустить
          </button>

          {isTap ? (
            <div
              className="font-overpass uppercase"
              style={{ color: '#A1FF4A', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 16 }}>👆</span> Нажми на подсвеченное
            </div>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="font-overpass uppercase transition-transform active:scale-95"
              style={{
                background: '#A1FF4A',
                color: '#060919',
                border: 'none',
                borderRadius: 999,
                padding: '12px 24px',
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Готово' : 'Далее'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(161,255,74,0.25), 0 0 22px rgba(161,255,74,0.30); }
          50% { box-shadow: 0 0 0 3px rgba(161,255,74,0.45), 0 0 34px rgba(161,255,74,0.55); }
        }
      `}</style>
    </div>
  );
}

function dimStyle(
  top: number,
  left: number,
  width: number | string,
  height: number | string,
): React.CSSProperties {
  return {
    position: 'fixed',
    top,
    left,
    width,
    height,
    background: DIM,
    pointerEvents: 'auto',
  };
}

// На шагах с реальным тапом клик по затемнённой области не должен ничего
// ломать — даём «пропустить»? Нет: просто гасим, чтобы не сбить пользователя.
// На 'next'-шагах клик мимо тоже ничего не делает (ждём кнопку).
function onSkipGuard(_isTap: boolean, _onSkip: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
  };
}
