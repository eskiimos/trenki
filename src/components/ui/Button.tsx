import React from 'react';

// Единая кнопка приложения. Канон (по UI-аудиту): primary = лайм-пилюля
// #A1FF4A/#060919, radius 999, 12×24, 14/800 uppercase, 0.04em. size='sm'
// для компактных мест (плашки, шапки). ghost = прозрачная с hairline-рамкой.
type Variant = 'primary' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const PAD: Record<Size, string> = { md: '12px 24px', sm: '8px 16px' };
const FONT: Record<Size, number> = { md: 14, sm: 12 };

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  style,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const variantStyle: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--color-brand)', color: 'var(--color-night)', border: 'none' }
      : { background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--border-hairline)' };

  return (
    <button
      disabled={disabled}
      className={`ui-pressable ${variant === 'ghost' ? 'ui-btn-ghost' : ''} ${className}`.trim()}
      style={{
        fontFamily: 'Overpass, sans-serif',
        fontWeight: 800,
        fontSize: FONT[size],
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-pill)',
        padding: PAD[size],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        width: fullWidth ? '100%' : undefined,
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
