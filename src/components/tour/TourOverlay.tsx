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

export default function TourOverlay({ step, rect, index, total, onNext }: Props) {
  const isLast = !!step.isLast;
  const isTap = step.advanceOn === 'tap';

  // Тултип — bottom-sheet: по умолчанию закреплён внизу экрана. Если же
  // подсвеченный элемент сам в нижней части (напр. кнопка «Вперёд») и
  // нижний тултип его перекрыл бы — поднимаем тултип наверх. Без цели —
  // по центру. Так подсказка не налезает на фокус ни на одном экране.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const targetNearBottom = rect ? rect.top + rect.height > vh * 0.62 : false;
  const tooltipPos: React.CSSProperties = !rect
    ? { top: '50%', transform: 'translateY(-50%)' }
    : targetNearBottom
    ? { top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }
    : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' };

  return (
    // pointer-events:none на контейнере — иначе прозрачный слой на весь экран
    // перехватывал бы клик по «дырке» спотлайта, и реальный элемент нельзя
    // было бы нажать. Блокирующие части (затемнение, тултип) включают
    // pointer-events обратно.
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}>
      {/* Затемнение */}
      {rect ? (
        <>
          {/* top */}
          <div style={dimStyle(0, 0, '100vw', Math.max(0, rect.top - PAD))} onClick={(e) => e.stopPropagation()} />
          {/* bottom */}
          <div
            style={dimStyle(
              rect.top + rect.height + PAD,
              0,
              '100vw',
              `calc(100vh - ${rect.top + rect.height + PAD}px)`,
            )}
            onClick={(e) => e.stopPropagation()}
          />
          {/* left */}
          <div
            style={dimStyle(rect.top - PAD, 0, Math.max(0, rect.left - PAD), rect.height + PAD * 2)}
            onClick={(e) => e.stopPropagation()}
          />
          {/* right */}
          <div
            style={dimStyle(
              rect.top - PAD,
              rect.left + rect.width + PAD,
              `calc(100vw - ${rect.left + rect.width + PAD}px)`,
              rect.height + PAD * 2,
            )}
            onClick={(e) => e.stopPropagation()}
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
          {/* На 'next'-шагах гасим клики по подсвеченному, чтобы пользователь
              не запустил реальное действие случайно (напр. сабмит генерации).
              Продвижение — только кнопкой «Далее». На 'tap'-шагах этого слоя
              нет — там «дырка» открыта для реального клика. */}
          {!isTap && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                pointerEvents: 'auto',
                background: 'transparent',
              }}
            />
          )}
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: DIM, pointerEvents: 'auto' }} />
      )}

      {/* Тултип */}
      <div
        className="tour-tooltip"
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          ...tooltipPos,
          zIndex: 9999,
          background: 'var(--color-surface)',
          border: '1px solid var(--border-lime)',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset',
          maxWidth: 460,
          marginLeft: 'auto',
          marginRight: 'auto',
          pointerEvents: 'auto',
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

        {/* Заголовок с аватаром ИИ-помощника */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              overflow: 'hidden',
              flexShrink: 0,
              background: 'var(--color-night)',
              border: '2px solid rgba(161,255,74,0.5)',
              boxShadow: '0 0 16px rgba(161,255,74,0.25)',
            }}
          >
            <img
              src="/avatars/Ai_robot.jpeg"
              alt="ИИ-помощник"
              width={44}
              height={44}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div
            className="font-overpass uppercase"
            style={{ color: '#A1FF4A', fontSize: 15, fontWeight: 900, letterSpacing: '0.3px', lineHeight: '120%' }}
          >
            {step.title}
          </div>
        </div>
        <div
          className="font-overpass"
          style={{ color: '#D7D5E0', fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 16 }}
        >
          {step.body}
        </div>

        {/* Подсказка на тап показывается только когда есть что нажать (rect).
            Иначе (фолбэк без элемента) — кнопка «Далее», чтобы тур не застрял
            (кнопки «Пропустить» больше нет). */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {isTap && rect ? (
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
        @keyframes tourTooltipIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tour-tooltip {
          animation: tourTooltipIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
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
