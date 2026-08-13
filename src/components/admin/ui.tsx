'use client';

// ─── Примитивы админки «Треньки» ───────────────────────────────────────────
// Единый источник вёрстки для всех /admin/* страниц. До этого админка жила в
// «выдуманной» палитре (фон страницы #101530 — это токен КАРТОЧЕК, карточки
// #1a1f3a/#2d3448 — цвета, которых нет в токенах), имела 6 разных шапок и
// 4 варианта стрелки «назад». Здесь всё сведено к токенам из globals.css.
//
// Правила (см. /admin/ui-kit):
//   фон страницы  — var(--color-night)    #060919
//   карточка      — var(--color-surface)  #101530 + hairline-рамка
//   текст         — var(--color-ink) / вторичный var(--color-muted)
//   акцент        — var(--color-brand)    #A1FF4A
//   иконки        — lucide, 16 inline / 20 в карточках и кнопках / 24 в шапке
//   отступы       — 4-сетка (8/12/16/24), радиусы — токены --radius-*

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

/* ─── Обёртка страницы ─────────────────────────────────────────────────── */

export function AdminPage({
  children,
  width = 'wide',
}: {
  children: React.ReactNode;
  /** wide — списки/дашборд (1200), narrow — формы и настройки (720) */
  width?: 'wide' | 'narrow';
}) {
  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        background: 'var(--color-night)',
        color: 'var(--color-ink)',
        // Верхний вырез: без этого в iOS-PWA (standalone) шапка страницы и
        // ссылка «назад» уезжают под статус-бар. Раньше каждая admin-страница
        // писала этот calc сама — теперь он один, здесь.
        paddingTop: 'calc(var(--safe-top) + var(--space-4))',
      }}
    >
      <div style={{ maxWidth: width === 'wide' ? 1200 : 720, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

/* ─── Единая шапка страницы (заменяет 6 разных вариантов) ──────────────── */

export function PageHeader({
  title,
  icon: Icon,
  subtitle,
  backHref = '/admin',
  backLabel = 'В админку',
  actions,
}: {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  /** null — не показывать ссылку назад */
  backHref?: string | null;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header style={{ marginBottom: 24 }}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 12 }}
        >
          <ArrowLeft size={16} aria-hidden />
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <Icon size={24} style={{ color: 'var(--color-brand)', flexShrink: 0 }} aria-hidden />}
          <div className="min-w-0">
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>{title}</h1>
            {subtitle && (
              <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: '4px 0 0' }}>{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/* ─── Заголовок секции внутри страницы ─────────────────────────────────── */

export function SectionTitle({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h2
      className="flex items-center gap-2"
      style={{
        fontSize: 12,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--color-muted)',
        margin: '0 0 12px',
      }}
    >
      {Icon && <Icon size={16} aria-hidden />}
      {children}
    </h2>
  );
}

/* ─── Карточка ─────────────────────────────────────────────────────────── */

export function AdminCard({
  children,
  tone = 'default',
  style,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'accent' | 'danger' }) {
  const TONE: Record<string, React.CSSProperties> = {
    default: { background: 'var(--color-surface)', border: '1px solid var(--border-hairline)' },
    accent: { background: 'rgba(161,255,74,0.08)', border: '1px solid var(--border-lime)' },
    danger: { background: 'rgba(255,140,74,0.08)', border: '1px solid rgba(255,140,74,0.30)' },
  };
  return (
    <div
      className={className}
      style={{ borderRadius: 'var(--radius-md)', padding: 16, ...TONE[tone], ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ─── KPI-метрика (дашборд/статистика) ─────────────────────────────────── */

export function Kpi({
  icon: Icon,
  value,
  label,
  hint,
  href,
  accent = false,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  hint?: string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className="h-full transition-colors"
      style={{
        borderRadius: 'var(--radius-md)',
        padding: 16,
        background: accent ? 'rgba(161,255,74,0.10)' : 'var(--color-surface)',
        border: `1px solid ${accent ? 'var(--border-lime)' : 'var(--border-hairline)'}`,
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <Icon
          size={20}
          style={{ color: accent ? 'var(--color-brand)' : 'var(--color-muted)', flexShrink: 0 }}
          aria-hidden
        />
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-muted)',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          lineHeight: 1,
          color: accent ? 'var(--color-brand)' : 'var(--color-ink)',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ─── Карточка-ссылка в разделе ────────────────────────────────────────── */

export function NavCard({
  href,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 transition-colors hover:brightness-125"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
      }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(161,255,74,0.12)' }}
      >
        <Icon size={20} style={{ color: 'var(--color-brand)' }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
          {!!badge && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--color-brand)',
                color: 'var(--color-night)',
              }}
            >
              {badge}
            </span>
          )}
        </span>
        {desc && (
          <span
            className="block"
            style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}
          >
            {desc}
          </span>
        )}
      </span>
    </Link>
  );
}

/* ─── Кнопка ───────────────────────────────────────────────────────────── */

export function AdminButton({
  tone = 'primary',
  size = 'md',
  icon: Icon,
  children,
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
}) {
  const TONE: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-brand)', color: 'var(--color-night)', border: 'none' },
    secondary: {
      background: 'transparent',
      color: 'var(--color-ink)',
      border: '1px solid var(--border-hairline)',
    },
    danger: {
      background: 'rgba(255,140,74,0.15)',
      color: 'var(--color-danger)',
      border: '1px solid rgba(255,140,74,0.30)',
    },
  };
  return (
    <button
      className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85 disabled:opacity-50"
      style={{
        // ≥44px по высоте на md — комфортный тач-таргет (админку открывают с планшета)
        minHeight: size === 'md' ? 44 : 36,
        padding: size === 'md' ? '10px 20px' : '8px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize: size === 'md' ? 14 : 13,
        fontWeight: 700,
        cursor: 'pointer',
        ...TONE[tone],
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={size === 'md' ? 20 : 16} aria-hidden />}
      {children}
    </button>
  );
}

/* ─── Состояния списка: загрузка / пусто / ошибка ──────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  tone = 'default',
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '48px 16px', color: 'var(--color-muted)' }}
    >
      {Icon && (
        <Icon
          size={24}
          style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-muted)', marginBottom: 12 }}
          aria-hidden
        />
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-ink)' }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 13, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ─── Поля форм: единые классы вместо разнобоя ─────────────────────────── */

/** Применять к <input>/<select>/<textarea> в админке. */
export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 14px',
  background: 'var(--color-night)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-ink)',
  fontSize: 14,
};

/** Подпись над полем. */
export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--color-muted)',
  marginBottom: 6,
};
