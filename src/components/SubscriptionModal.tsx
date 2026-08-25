'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import {
  subscribeSubscriptionModal,
  closeSubscriptionModal,
  type PaywallReason,
} from '@/lib/subscription-modal';
import { FREE_FEATURES, PAID_FEATURES } from '@/lib/subscription-plan';

// Глобальная модалка подписки (п.3 «оформи подписку» + п.4 «что входит + цена»).
// Хост монтируется один раз в layout; открывается из любого места через
// openSubscriptionModal(reason). Кнопка «Оформить» пока заглушка — реальная оплата
// (T-Bank) подключается отдельным треком; премиум на обкатке выдаётся из админки.

const TITLES: Record<PaywallReason, { title: string; subtitle: string; cta: string }> = {
  generic: { title: 'Оформи подписку', subtitle: 'Открой все возможности «Треньки»', cta: 'Оформить' },
  video: { title: 'Видео-занятия — по подписке', subtitle: 'Полный доступ к библиотеке тренировок', cta: 'Оформить' },
  'ai-workout': { title: 'Лимит бесплатных тренировок', subtitle: 'Бесплатно — 1 ИИ-тренировка в неделю. Дальше — по подписке', cta: 'Оформить' },
  microcycle: { title: 'Календарь и микроциклы — по подписке', subtitle: 'Персональный план недели от ИИ-тренера', cta: 'Оформить' },
  potential: { title: 'Шкала потенциала — по подписке', subtitle: 'Следи за ростом характеристик', cta: 'Оформить' },
  expiring: { title: 'Подписка скоро закончится', subtitle: 'Продли, чтобы не терять доступ', cta: 'Продлить подписку' },
};

export default function SubscriptionModal() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>('generic');
  const [promo, setPromo] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const { referralCode } = useSubscription();
  const pricing = useSubscriptionPricing();

  // Персональная цена (промокод + сколько интро-оплат осталось) — ровно то,
  // что спишет /api/payments/init. Раньше модалка всегда показывала базовую
  // цену, и юзер с промокодом видел «стандартные» 1200 ₽ (жалоба владельца).
  const [me, setMe] = useState<{
    amountRub: number;
    isIntro: boolean;
    introPaymentsLeft: number;
    basePriceRub: number;
  } | null>(null);

  // meError: персональная цена НЕ загрузилась — показываем базовую с оговоркой
  // (итог — на странице банка), но оплату не блокируем: упавший pricing/me не
  // должен останавливать выручку.
  const [meError, setMeError] = useState(false);

  const loadMyPricing = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/subscription/pricing/me', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d && typeof d.amountRub === 'number') {
        setMe(d);
        setMeError(false);
        return true;
      }
      throw new Error();
    } catch {
      setMeError(true);
      return false;
    }
  };
  useEffect(() => {
    if (open) {
      setMe(null);
      setMeError(false);
      loadMyPricing();
    }
  }, [open]);

  const applyPromo = async () => {
    const code = promo.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/referral/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      // 409 = код уже привязан — для юзера это тоже «применён»
      if (!res.ok && res.status !== 409) {
        setPromoError(data?.error || 'Не удалось применить промокод');
        return;
      }
      // Сначала пересчитываем цену, потом показываем «применён» — иначе при
      // сбое перезагрузки зелёная плашка соседствовала бы со старой ценой.
      const reloaded = await loadMyPricing();
      setPromoApplied(data?.label || data?.code || code);
      if (!reloaded) {
        setPromoError('Код привязан; цена обновится на странице оплаты');
      }
    } catch {
      setPromoError('Сетевая ошибка');
    } finally {
      setPromoBusy(false);
    }
  };

  const handleSubscribe = async () => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch('/api/payments/init', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.paymentURL) {
        window.location.href = data.paymentURL; // редирект на оплату T-Bank
        return;
      }
      setPayError(data?.error || 'Не удалось перейти к оплате');
    } catch {
      setPayError('Сетевая ошибка');
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
    return subscribeSubscriptionModal((isOpen, r) => {
      setReason(r);
      setOpen(isOpen);
    });
  }, []);

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSubscriptionModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const t = TITLES[reason] ?? TITLES.generic;

  return (
    <div
      onClick={closeSubscriptionModal}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--scrim, rgba(6,9,25,0.72))',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-popIn"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#101530',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: '1px solid #26252F',
          borderBottom: 'none',
          padding: '22px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Ручка + закрыть */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
          <span style={{ width: 40, height: 4, borderRadius: 999, background: '#2d3448' }} />
          <button
            onClick={closeSubscriptionModal}
            aria-label="Закрыть"
            style={{
              position: 'absolute',
              right: 0,
              top: -6,
              background: 'transparent',
              border: 'none',
              color: '#AEABBB',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <h2
          className="font-overpass uppercase"
          style={{ color: '#F9F8FE', fontWeight: 900, fontSize: 20, lineHeight: 1.15, letterSpacing: 0.3 }}
        >
          {t.title}
        </h2>
        <p style={{ color: '#AEABBB', fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{t.subtitle}</p>

        {/* Что входит */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <div style={{ color: '#A1FF4A', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            По подписке
          </div>
          {PAID_FEATURES.map((f) => (
            <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Check size={20} color="#A1FF4A" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
              <span style={{ color: '#F9F8FE', fontSize: 14, lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
          <div style={{ color: '#6E6B7B', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Бесплатно
          </div>
          {FREE_FEATURES.map((f) => (
            <div key={f} style={{ color: '#AEABBB', fontSize: 13, lineHeight: 1.4 }}>
              • {f}
            </div>
          ))}
        </div>

        {/* Цена */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(161,255,74,0.12), rgba(68,92,255,0.14))',
            border: '1px solid #2d3448',
          }}
        >
          {me?.isIntro ? (
            <>
              {/* Интро-цена по промокоду: показываем ровно то, что спишется */}
              <div style={{ color: '#F9F8FE', fontSize: 22, fontWeight: 900 }}>
                <span style={{ color: '#A1FF4A' }}>{me.amountRub} ₽</span>
                <span style={{ fontSize: 15, color: '#6E6B7B', fontWeight: 700, textDecoration: 'line-through', marginLeft: 8 }}>
                  {me.basePriceRub} ₽
                </span>
                <span style={{ fontSize: 14, color: '#AEABBB', fontWeight: 700 }}> / 30 дней</span>
              </div>
              <div style={{ color: '#AEABBB', fontSize: 13, marginTop: 2 }}>
                Цена по промокоду тренера — осталось {me.introPaymentsLeft}{' '}
                {me.introPaymentsLeft === 1 ? 'оплата' : me.introPaymentsLeft < 5 ? 'оплаты' : 'оплат'} по
                этой цене, дальше {me.basePriceRub} ₽/мес
              </div>
            </>
          ) : me === null && !meError ? (
            /* Персональная цена грузится: базовую как «твою» не показываем —
               у юзера с промокодом спишется другая (жалоба владельца) */
            <div style={{ color: '#AEABBB', fontSize: 22, fontWeight: 900 }}>
              … ₽<span style={{ fontSize: 14, fontWeight: 700 }}> / 30 дней</span>
            </div>
          ) : (
            <>
              <div style={{ color: '#F9F8FE', fontSize: 22, fontWeight: 900 }}>
                {me?.amountRub ?? pricing.priceMonthlyRub} ₽
                <span style={{ fontSize: 14, color: '#AEABBB', fontWeight: 700 }}> / 30 дней</span>
              </div>
              {meError && (
                <div style={{ color: '#AEABBB', fontSize: 12, marginTop: 2 }}>
                  Итоговая цена (с учётом промокода) — на странице оплаты
                </div>
              )}
              {pricing.introDiscountPercent > 0 && pricing.introMonths > 0 && !referralCode && !promoApplied && (
                <div style={{ color: '#AEABBB', fontSize: 13, marginTop: 2 }}>
                  по промокоду тренера — до −{pricing.introDiscountPercent}% на первые {pricing.introMonths} мес.
                  (от {pricing.introPriceRub} ₽/мес)
                </div>
              )}
            </>
          )}
        </div>

        {/* Промокод тренера — только если канал ещё не привязан. Поле раньше
            было декорацией (значение никуда не уходило) — теперь «Применить»
            привязывает код и пересчитывает цену. */}
        {!referralCode && !promoApplied && (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: '#AEABBB', fontSize: 12, marginBottom: 6 }}>Промокод тренера (если есть)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
              <input
                value={promo}
                onChange={(e) => { setPromo(e.target.value); setPromoError(null); }}
                placeholder="Например, ЛЕТО26"
                style={{
                  minWidth: 0,
                  background: '#060919',
                  border: '1px solid #26252F',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#F9F8FE',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={promoBusy || !promo.trim()}
                className="font-overpass uppercase"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(161,255,74,0.5)',
                  color: '#A1FF4A',
                  borderRadius: 10,
                  padding: '0 16px',
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 0.4,
                  cursor: promoBusy || !promo.trim() ? 'default' : 'pointer',
                  opacity: promoBusy || !promo.trim() ? 0.5 : 1,
                }}
              >
                {promoBusy ? '…' : 'Применить'}
              </button>
            </div>
            {promoError && (
              <div style={{ color: '#FF8C4A', fontSize: 12, marginTop: 6 }}>{promoError}</div>
            )}
          </div>
        )}
        {promoApplied && (
          <div style={{ marginTop: 14, color: '#A1FF4A', fontSize: 13 }}>
            Промокод «{promoApplied}» применён
          </div>
        )}

        {/* Оформить → T-Bank Init → редирект на оплату */}
        <button
          onClick={handleSubscribe}
          disabled={paying || (me === null && !meError)}
          className="font-overpass uppercase transition-transform active:scale-95"
          style={{
            width: '100%',
            marginTop: 20,
            background: '#A1FF4A',
            color: '#060919',
            border: 'none',
            borderRadius: 999,
            padding: '15px 20px',
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: 0.3,
            cursor: paying ? 'wait' : 'pointer',
            opacity: paying ? 0.7 : 1,
          }}
        >
          {paying ? 'Переходим к оплате…' : t.cta}
        </button>
        {payError && (
          <p style={{ color: '#FF6B6B', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{payError}</p>
        )}
        <p style={{ color: '#6E6B7B', fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
          Оплата картой — разовая, за 30 дней доступа. Автосписаний нет: когда срок
          закончится, продлить можно вручную.
        </p>
      </div>
    </div>
  );
}
