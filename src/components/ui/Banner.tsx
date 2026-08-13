import React from 'react';
import { X } from 'lucide-react';

// Акцентный баннер (плашка) на едином grad-accent + лайм-рамке. Иконка слева,
// заголовок/подзаголовок, action справа, опциональный крестик (onDismiss).
interface BannerProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export default function Banner({ icon, title, subtitle, action, onDismiss, style }: BannerProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        paddingRight: onDismiss ? 36 : 16,
        background: 'var(--grad-accent)',
        border: '1px solid var(--border-lime)',
        borderRadius: 'var(--radius-md)',
        ...style,
      }}
    >
      {icon && <div style={{ flexShrink: 0 }}>{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="font-overpass" style={{ color: 'var(--color-ink)', fontSize: 14, fontWeight: 700 }}>
          {title}
        </div>
        {subtitle && (
          <div className="font-overpass" style={{ color: 'var(--color-muted)', fontSize: 12 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: 6,
            right: 10,
            color: 'var(--color-muted)',
            background: 'none',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          <X size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}
