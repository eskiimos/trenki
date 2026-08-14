'use client';

/**
 * Строки-списки профиля и настроек — единый источник правды по геометрии.
 *
 * По UI-киту (/admin/ui-kit):
 *  · строка = py-4 (--space-4) + gap-3 (--space-3), высота ≈ 56;
 *  · ведущая иконка 20 (--icon-md, «кнопки / строки / баннеры»), только lucide —
 *    эмодзи в UI атлета запрещены;
 *  · разделитель — hairline (--border-hairline), рисуется самой строкой
 *    (border-t + first:border-t-0), поэтому вызывающему коду не нужно
 *    вручную расставлять <div className="h-[1px]"> между строками;
 *  · группа = eyebrow-заголовок + карточка bg-night на странице bg-surface
 *    (конвенция профильного раздела).
 */

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink, type LucideIcon } from 'lucide-react';

/** Цвет разделителя строк — токен кита, не хардкод. */
const HAIRLINE = 'var(--border-hairline)';

/** Общий каркас строки: разделитель сверху, кроме первой в группе. */
const ROW = 'w-full flex items-center gap-3 py-4 text-left border-t first:border-t-0';

export function SettingsGroup({
  title,
  hint,
  hintTone = 'muted',
  children,
}: {
  title?: string;
  /** Пояснение под группой — мелким текстом. */
  hint?: string;
  /** 'danger' — для сообщений об ошибке: приглушённый muted их прячет. */
  hintTone?: 'muted' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-muted text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
          {title}
        </h2>
      )}
      <div className="bg-night rounded-lg px-4">{children}</div>
      {hint && (
        <p
          className={`text-xs leading-snug mt-2 px-1 ${
            hintTone === 'danger' ? 'text-danger' : 'text-muted'
          }`}
          role={hintTone === 'danger' ? 'alert' : undefined}
        >
          {hint}
        </p>
      )}
    </section>
  );
}

interface RowContentProps {
  icon: LucideIcon;
  label: string;
  /** Вторая строка — зачем этот пункт нужен. */
  hint?: string;
  danger?: boolean;
  children?: React.ReactNode;
}

/** Содержимое строки: иконка · (лейбл + подсказка) · трейлинг.
 *  Внутри <button> нельзя <div> — поэтому только span с display:block. */
function RowContent({ icon: Icon, label, hint, danger, children }: RowContentProps) {
  return (
    <>
      <Icon
        size={20}
        aria-hidden
        className={`shrink-0 ${danger ? 'text-danger' : 'text-muted'}`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-medium font-overpass uppercase tracking-wide ${
            danger ? 'text-danger' : 'text-white'
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="block text-muted text-xs font-normal normal-case tracking-normal leading-snug mt-0.5">
            {hint}
          </span>
        )}
      </span>
      {children}
    </>
  );
}

const Chevron = () => (
  <ChevronRight size={20} aria-hidden className="text-muted/60 shrink-0" />
);

/** Строка-переход: внутренний экран (chevron) или внешняя ссылка (ExternalLink).
 *  Внешние ссылки — настоящий <a target="_blank">, а не window.open: не режется
 *  блокировщиком попапов и корректно читается скринридером. */
export function NavRow({
  href,
  icon,
  label,
  hint,
  external = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  external?: boolean;
}) {
  const className = `${ROW} hover:opacity-80 transition-opacity`;
  const content = (
    <RowContent icon={icon} label={label} hint={hint}>
      {external ? (
        <ExternalLink size={20} aria-hidden className="text-muted/60 shrink-0" />
      ) : (
        <Chevron />
      )}
    </RowContent>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={{ borderTopColor: HAIRLINE }}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className} style={{ borderTopColor: HAIRLINE }}>
      {content}
    </Link>
  );
}

/** Строка-действие: внутреннее (chevron), внешняя ссылка (ExternalLink) или
 *  destructive (danger, без стрелки). */
export function ActionRow({
  icon,
  label,
  hint,
  onClick,
  danger = false,
  external = false,
  disabled = false,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
  external?: boolean;
  disabled?: boolean;
  /** Кастомный трейлинг вместо стрелки (например, «Отмена»). */
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${ROW} hover:opacity-80 transition-opacity disabled:opacity-50`}
      style={{ borderTopColor: HAIRLINE }}
    >
      <RowContent icon={icon} label={label} hint={hint} danger={danger}>
        {trailing ??
          (external ? (
            <ExternalLink size={20} aria-hidden className="text-muted/60 shrink-0" />
          ) : danger ? null : (
            <Chevron />
          ))}
      </RowContent>
    </button>
  );
}

/** Строка-переключатель. role="switch" + aria-checked — иначе скринридер
 *  читает её как обычную кнопку и состояние теряется. */
export function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`${ROW} disabled:opacity-50`}
      style={{ borderTopColor: HAIRLINE }}
    >
      <RowContent icon={icon} label={label} hint={hint}>
        <span
          aria-hidden
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            checked ? 'bg-brand' : 'bg-white/20'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </span>
      </RowContent>
    </button>
  );
}

/** Разворачивающийся вопрос FAQ — та же геометрия строки. */
export function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-t first:border-t-0" style={{ borderTopColor: HAIRLINE }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 py-4 text-left hover:opacity-80 transition-opacity"
      >
        <span className="min-w-0 flex-1 text-white text-sm font-normal font-overpass">
          {question}
        </span>
        <ChevronRight
          size={20}
          aria-hidden
          className={`text-muted/60 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <p className="text-muted text-xs font-normal font-overpass leading-relaxed pb-4 -mt-1">
          {answer}
        </p>
      )}
    </div>
  );
}
