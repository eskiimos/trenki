import React from 'react';

// Чип-переключатель (фильтры, цели, состояния). Канон по UI-аудиту: pill,
// padding 12×16, min-height 44, 13/700 uppercase, 0.5px. active — лайм-фон/
// тёмный текст; inactive — лёгкая подложка + hairline-рамка.
interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export default function Chip({ active = false, style, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={`ui-pressable ${className}`.trim()}
      style={{
        fontFamily: 'Overpass, sans-serif',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-pill)',
        padding: '12px 16px',
        minHeight: 44,
        cursor: 'pointer',
        ...(active
          ? { background: 'var(--color-brand)', color: 'var(--color-night)', border: 'none' }
          : { background: 'rgba(174, 171, 187, 0.12)', color: 'var(--color-ink)', border: '1px solid var(--border-hairline)' }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
