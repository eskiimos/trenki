// Статус премиума для админки (правка владельца «Начало сентября»: бейдж
// «PREMIUM» горел и у тех, чей пробный период давно кончился, и не отличал
// триал от оплаты). Чистая логика поверх полей User + факта оплат.
//
// Источник «платил ли»: Payment.premiumGrantedAt != null — единственный
// надёжный признак успешного заказа (статусы T-Bank шумные, см. user-pricing).
// Триал отличаем по premiumNote, которую ставит verify-code при регистрации
// («Пробный период N дн. …»). Всё остальное с accessTier=PREMIUM — ручная
// выдача из админки.

import { hasPremium } from '@/lib/access';

export type PremiumKind = 'paid' | 'trial' | 'manual' | 'none';

export interface PremiumStatusInput {
  accessTier: string;
  premiumUntil: Date | string | null;
  premiumNote?: string | null;
  /** Сколько заказов реально выдали премиум (Payment.premiumGrantedAt != null) */
  paidCount: number;
}

export interface PremiumStatus {
  kind: PremiumKind;
  /** Премиум действует прямо сейчас (учитывает срок) */
  active: boolean;
  /** accessTier=PREMIUM, но срок вышел */
  expired: boolean;
  /** Короткая подпись для бейджа; null — бейдж не показываем */
  label: string | null;
}

const TRIAL_NOTE_PREFIX = 'Пробный период';

export function premiumKind(input: PremiumStatusInput): PremiumKind {
  if (input.paidCount > 0) return 'paid';
  if (input.accessTier !== 'PREMIUM') return 'none';
  if ((input.premiumNote ?? '').startsWith(TRIAL_NOTE_PREFIX)) return 'trial';
  return 'manual';
}

const ACTIVE_LABEL: Record<PremiumKind, string | null> = {
  paid: 'Премиум',
  trial: 'Пробный период',
  manual: 'Премиум (вручную)',
  none: null,
};

export function premiumStatus(input: PremiumStatusInput, now: Date = new Date()): PremiumStatus {
  const kind = premiumKind(input);
  const active = hasPremium(input, now);
  const expired = input.accessTier === 'PREMIUM' && !active;
  if (active) return { kind, active, expired: false, label: ACTIVE_LABEL[kind] };
  if (expired) {
    return {
      kind,
      active: false,
      expired: true,
      label: kind === 'trial' ? 'Пробный истёк' : 'Премиум истёк',
    };
  }
  // FREE: когда-то платил — полезно видеть в списке
  return { kind, active: false, expired: false, label: kind === 'paid' ? 'Платил раньше' : null };
}
