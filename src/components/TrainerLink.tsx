'use client';

// Аватар/имя тренера внутри карточки видео → страница тренера (правки
// «Середина сентября», п.2). Раньше карточка целиком была ссылкой на видео, и
// тап по тренеру открывал видео.
//
// Вкладывать <a> в <a> нельзя (невалидный HTML, ошибка гидратации), поэтому
// карточки устроены так: ссылка на видео растянута на всю карточку
// псевдоэлементом (after:absolute after:inset-0), а эта ссылка лежит поверх
// (relative z-1) — остальная карточка по-прежнему ведёт на видео.
//
// Нет id тренера (старый ответ API) — рендерим обычный span с теми же стилями:
// тап тогда проходит на видео, как раньше.

import Link from 'next/link';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { trainerProfileHref } from '@/lib/trainer-link';

interface TrainerLinkProps {
  trainer: { id?: string | null } | null | undefined;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}

export default function TrainerLink({ trainer, className, style, ariaLabel, onClick, children }: TrainerLinkProps) {
  const href = trainerProfileHref(trainer);
  if (!href) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`relative z-1 ${className ?? ''}`}
      style={style}
    >
      {children}
    </Link>
  );
}
