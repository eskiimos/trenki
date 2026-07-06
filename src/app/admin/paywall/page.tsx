'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Mode = 'off' | 'admins' | 'on';

const OPTIONS: { value: Mode; title: string; desc: string; accent: string }[] = [
  {
    value: 'off',
    title: 'Выключен',
    desc: 'Paywall не работает. Все функции бесплатны для всех. Безопасное состояние.',
    accent: '#AEABBB',
  },
  {
    value: 'admins',
    title: 'Только админы (обкатка)',
    desc: 'Paywall видят и упираются в него ТОЛЬКО админы приложения (isAdmin). Живые пользователи ничего не замечают — можно тестировать в проде.',
    accent: '#A1FF4A',
  },
  {
    value: 'on',
    title: 'Включён для всех',
    desc: 'Paywall активен для всех без премиума. Платные функции закрыты, показываются окна оформления подписки.',
    accent: '#FF9F45',
  },
];

// Админка: режим paywall (роллаут-контроль, читается сервером из app_settings).
export default function PaywallAdminPage() {
  const [mode, setMode] = useState<Mode>('off');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Цены (редактируются здесь же)
  const [priceMonthly, setPriceMonthly] = useState('1200');
  const [discount, setDiscount] = useState('75');
  const [months, setMonths] = useState('3');
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceMsg, setPriceMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/paywall');
        if (res.ok) {
          const d = await res.json();
          if (d?.mode) setMode(d.mode);
          if (d?.pricing) {
            setPriceMonthly(String(d.pricing.priceMonthlyRub ?? 1200));
            setDiscount(String(d.pricing.introDiscountPercent ?? 75));
            setMonths(String(d.pricing.introMonths ?? 3));
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const introPreview = Math.round(Number(priceMonthly) * (1 - Number(discount) / 100));

  const savePricing = async () => {
    setSavingPrice(true);
    setPriceMsg(null);
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricing: {
            priceMonthlyRub: Number(priceMonthly),
            introDiscountPercent: Number(discount),
            introMonths: Number(months),
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPriceMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      if (d?.pricing) {
        setPriceMonthly(String(d.pricing.priceMonthlyRub));
        setDiscount(String(d.pricing.introDiscountPercent));
        setMonths(String(d.pricing.introMonths));
      }
      setPriceMsg({ type: 'ok', text: 'Цены сохранены ✓' });
    } catch {
      setPriceMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSavingPrice(false);
    }
  };

  const save = async (next: Mode) => {
    setSaving(true);
    setMsg(null);
    const prev = mode;
    setMode(next); // оптимистично
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMode(prev);
        setMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      setMode(d.mode);
      setMsg({ type: 'ok', text: 'Сохранено ✓' });
    } catch {
      setMode(prev);
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#101530', minHeight: '100vh', color: '#F9F8FE' }}>
      <div
        className="max-w-2xl mx-auto px-5 pb-24"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
      >
        <Link href="/admin" style={{ color: '#AEABBB', fontSize: 13 }}>
          ← В админку
        </Link>
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 24, marginTop: 8 }}>
          🔒 Paywall (подписка)
        </h1>
        <p style={{ color: '#AEABBB', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Режим показа платного доступа. Меняется на лету, без перезапуска. Премиум-пользователи
          не упираются в paywall ни в каком режиме.
        </p>

        {loading ? (
          <div style={{ color: '#AEABBB', fontSize: 14, marginTop: 30 }}>Загружаем…</div>
        ) : (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {OPTIONS.map((opt) => {
              const active = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !saving && !active && save(opt.value)}
                  disabled={saving}
                  style={{
                    textAlign: 'left',
                    background: active ? '#0B1030' : '#0B1030',
                    border: `2px solid ${active ? opt.accent : '#26252F'}`,
                    borderRadius: 16,
                    padding: 18,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: `2px solid ${active ? opt.accent : '#4A4857'}`,
                        background: active ? opt.accent : 'transparent',
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontWeight: 800, fontSize: 15, color: active ? opt.accent : '#F9F8FE' }}>
                      {opt.title}
                    </span>
                  </div>
                  <div style={{ color: '#AEABBB', fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}

            {msg && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginTop: 4,
                  color: msg.type === 'ok' ? '#A1FF4A' : '#FF6B6B',
                }}
              >
                {msg.text}
              </div>
            )}

            {/* Цены подписки */}
            <section
              style={{
                marginTop: 20,
                background: '#0B1030',
                border: '1px solid #26252F',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={{ color: '#F9F8FE', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                💳 Цены подписки
              </div>
              <div style={{ color: '#AEABBB', fontSize: 12.5, lineHeight: 1.45, marginBottom: 14 }}>
                Отображаются в окне оформления. Годовой тариф пока не используется.
              </div>
              <div className="flex gap-4 flex-wrap">
                {[
                  { lbl: 'Цена ₽/мес', val: priceMonthly, set: setPriceMonthly, min: 1, max: 1000000 },
                  { lbl: 'Скидка по промо, %', val: discount, set: setDiscount, min: 0, max: 100 },
                  { lbl: 'Интро, мес', val: months, set: setMonths, min: 0, max: 36 },
                ].map((f) => (
                  <div key={f.lbl}>
                    <div style={{ color: '#AEABBB', fontSize: 12, marginBottom: 4 }}>{f.lbl}</div>
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      style={{
                        background: '#060919',
                        border: '1px solid #26252F',
                        borderRadius: 10,
                        padding: '12px 14px',
                        color: '#F9F8FE',
                        fontSize: 16,
                        outline: 'none',
                        colorScheme: 'dark',
                        width: 120,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ color: '#AEABBB', fontSize: 13, marginTop: 12 }}>
                Со скидкой:{' '}
                <b style={{ color: '#A1FF4A' }}>
                  {Number.isFinite(introPreview) ? introPreview : '—'} ₽/мес
                </b>{' '}
                на первые {months} мес.
              </div>
              {priceMsg && (
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 10,
                    color: priceMsg.type === 'ok' ? '#A1FF4A' : '#FF6B6B',
                  }}
                >
                  {priceMsg.text}
                </div>
              )}
              <button
                type="button"
                onClick={savePricing}
                disabled={savingPrice}
                className="font-overpass uppercase transition-transform active:scale-95"
                style={{
                  marginTop: 14,
                  background: '#A1FF4A',
                  color: '#060919',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px 22px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: savingPrice ? 'not-allowed' : 'pointer',
                  opacity: savingPrice ? 0.6 : 1,
                }}
              >
                {savingPrice ? 'Сохраняю…' : 'Сохранить цены'}
              </button>
            </section>

            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 12,
                background: '#0B1030',
                border: '1px solid #26252F',
                color: '#AEABBB',
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              💡 «Только админы» — для обкатки в проде: отметь нужные аккаунты как админов
              (<Link href="/admin/admins" style={{ color: '#A1FF4A' }}>Администраторы</Link>) и
              переключи сюда. Премиум им выдаётся вручную на странице{' '}
              <Link href="/admin/users" style={{ color: '#A1FF4A' }}>Пользователи</Link>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
