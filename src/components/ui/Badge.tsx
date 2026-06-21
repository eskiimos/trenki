import React from 'react';

// Бейдж/ярлык. brand — лайм-текст (eyebrow), solid — лайм-фон/тёмный текст,
// muted — серый. Канон типографики: 11/800 uppercase, letterSpacing 0.5px.
type BadgeVariant = 'brand' | 'solid' | 'muted';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VAR: Record<BadgeVariant, React.CSSProperties> = {
  brand: { color: 'var(--color-brand)', background: 'transparent', padding: 0 },
  solid: { color: 'var(--color-night)', background: 'var(--color-brand)', padding: '2px 8px' },
  muted: { color: 'var(--color-muted)', background: 'transparent', padding: 0 },
};

export default function Badge({ variant = 'brand', style, children, ...rest }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'Overpass, sans-serif',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-pill)',
        ...VAR[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
