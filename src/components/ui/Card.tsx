import React from 'react';

// Единая карточка/поверхность. Варианты по UI-аудиту:
//   surface   — #101530 (стандарт), outlined — + hairline-рамка,
//   accent    — единый grad-accent + лайм-рамка (баннеры/акценты),
//   blue      — синяя подложка (плитки/дни), stat — серый блок метрик.
type CardVariant = 'surface' | 'outlined' | 'accent' | 'blue' | 'stat';
type Radius = 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  radius?: Radius;
}

const RADIUS: Record<Radius, string> = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
};

const VARIANT: Record<CardVariant, React.CSSProperties> = {
  surface: { background: 'var(--color-surface)' },
  outlined: { background: 'var(--color-surface)', border: '1px solid var(--border-hairline)' },
  accent: { background: 'var(--grad-accent)', border: '1px solid var(--border-lime)' },
  blue: { background: 'var(--blue-medium)' },
  stat: { background: 'rgba(174, 171, 187, 0.08)' },
};

export default function Card({ variant = 'surface', radius = 'sm', style, children, ...rest }: CardProps) {
  return (
    <div style={{ borderRadius: RADIUS[radius], ...VARIANT[variant], ...style }} {...rest}>
      {children}
    </div>
  );
}
