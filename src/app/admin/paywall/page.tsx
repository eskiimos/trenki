'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import {
  Lock,
  Unlock,
  ShieldCheck,
  CreditCard,
  ReceiptText,
  Gift,
  Lightbulb,
  Check,
  AlertCircle,
  Save,
  X,
  FlaskConical,
  Banknote,
  type LucideIcon,
} from 'lucide-react';

type Mode = 'off' | 'admins' | 'on';

const OPTIONS: { value: Mode; title: string; desc: string; icon: LucideIcon }[] = [
  {
    value: 'off',
    title: 'Выключен',
    desc: 'Paywall не работает. Все функции бесплатны для всех. Безопасное состояние.',
    icon: Unlock,
  },
  {
    value: 'admins',
    title: 'Только админы (обкатка)',
    desc: 'Paywall видят и упираются в него ТОЛЬКО админы приложения (isAdmin). Живые пользователи ничего не замечают — можно тестировать в проде.',
    icon: ShieldCheck,
  },
  {
    value: 'on',
    title: 'Включён для всех',
    desc: 'Paywall активен для всех без премиума. Платные функции закрыты, показываются окна оформления подписки.',
    icon: Lock,
  },
];

/** Единая плашка результата сохранения (было 4 копии одинаковой вёрстки). */
function StatusMsg({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null;
  const ok = msg.type === 'ok';
  return (
    <div
      className="flex items-center gap-2"
      aria-live="polite"
      style={{
        fontSize: 13,
        fontWeight: 700,
        marginTop: 12,
        color: ok ? 'var(--color-brand)' : 'var(--color-danger)',
      }}
    >
      {ok ? <Check size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}
      {msg.text}
    </div>
  );
}

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

  // Пробный период ДЛЯ ВСЕХ новых пользователей (оферта обещает 7 дней)
  const [trialDays, setTrialDays] = useState('7');
  const [savingTrial, setSavingTrial] = useState(false);
  const [trialMsg, setTrialMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // «Бесплатное занятие недели» — выбирается вручную из списка опубликованных видео.
  const [freeLesson, setFreeLesson] = useState<{ id: string; title: string } | null>(null);
  const [videos, setVideos] = useState<Array<{ id: string; title: string }>>([]);
  const [pickedVideoId, setPickedVideoId] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonMsg, setLessonMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Касса: боевая или тестовая (правка владельца). Секреты — в env, здесь
  // только режим и видимые TerminalKey, чтобы не перепутать терминалы.
  const [payMode, setPayMode] = useState<'live' | 'test'>('live');
  const [terminals, setTerminals] = useState<Record<string, { configured: boolean; terminalKey: string | null }>>({});
  const [savingPay, setSavingPay] = useState(false);
  const [payMsg, setPayMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const switchPayMode = async (next: 'live' | 'test') => {
    if (next === payMode || savingPay) return;
    if (
      next === 'test' &&
      !window.confirm('Переключить приём оплат на ТЕСТОВУЮ кассу? Реальные оплаты приниматься не будут.')
    ) {
      return;
    }
    setSavingPay(true);
    setPayMsg(null);
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentsMode: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayMsg({ type: 'err', text: d?.error || 'Не удалось переключить кассу' });
        return;
      }
      setPayMode(d?.payments?.mode ?? next);
      if (d?.payments?.terminals) setTerminals(d.payments.terminals);
      setPayMsg({
        type: 'ok',
        text: next === 'test' ? 'Оплаты идут через ТЕСТОВУЮ кассу' : 'Оплаты идут через боевую кассу',
      });
    } catch {
      setPayMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSavingPay(false);
    }
  };

  // Чек 54-ФЗ
  const [rcEnabled, setRcEnabled] = useState(false);
  const [rcEnabledTest, setRcEnabledTest] = useState(false);
  const [rcTaxation, setRcTaxation] = useState('usn_income');
  const [rcVat, setRcVat] = useState('none');
  const [savingRc, setSavingRc] = useState(false);
  const [rcMsg, setRcMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const saveReceipt = async () => {
    setSavingRc(true);
    setRcMsg(null);
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt: { enabled: rcEnabled, enabledTest: rcEnabledTest, taxation: rcTaxation, vat: rcVat },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRcMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      setRcMsg({
        type: 'ok',
        text: `Чеки сохранены: боевая — ${rcEnabled ? 'вкл' : 'выкл'}, тестовая — ${rcEnabledTest ? 'вкл' : 'выкл'}`,
      });
    } catch {
      setRcMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSavingRc(false);
    }
  };

  useEffect(() => {
    fetch('/api/videos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.videos)) {
          setVideos(d.videos.map((v: { id: string; title: string }) => ({ id: v.id, title: v.title })));
        }
      })
      .catch(() => {});
  }, []);

  const saveFreeLesson = async (videoId: string) => {
    setSavingLesson(true);
    setLessonMsg(null);
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeLessonVideoId: videoId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLessonMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      setFreeLesson(d.freeLesson ?? null);
      setPickedVideoId('');
      setLessonMsg({ type: 'ok', text: d.freeLesson ? 'Занятие недели обновлено' : 'Занятие недели снято' });
    } catch {
      setLessonMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSavingLesson(false);
    }
  };

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
          if (typeof d.trialDays === 'number') {
            setTrialDays(String(d.trialDays));
          }
          setFreeLesson(d?.freeLesson ?? null);
          if (d?.receipt) {
            setRcEnabled(Boolean(d.receipt.enabledLive ?? d.receipt.enabled));
            setRcEnabledTest(Boolean(d.receipt.enabledTest));
            setRcTaxation(d.receipt.taxation ?? 'usn_income');
            setRcVat(d.receipt.vat ?? 'none');
          }
          if (d?.payments) {
            setPayMode(d.payments.mode === 'test' ? 'test' : 'live');
            setTerminals(d.payments.terminals ?? {});
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

  const saveTrial = async () => {
    setSavingTrial(true);
    setTrialMsg(null);
    try {
      const res = await fetch('/api/admin/paywall', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialDays: Number(trialDays) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrialMsg({ type: 'err', text: d?.error || 'Не удалось сохранить' });
        return;
      }
      setTrialDays(String(d.trialDays));
      setTrialMsg({ type: 'ok', text: 'Сохранено' });
    } catch {
      setTrialMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSavingTrial(false);
    }
  };

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
      setPriceMsg({ type: 'ok', text: 'Цены сохранены' });
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
      setMsg({ type: 'ok', text: 'Сохранено' });
    } catch {
      setMode(prev);
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage width="narrow">
      <PageHeader
        title="Paywall (подписка)"
        icon={Lock}
        backHref="/admin"
        subtitle="Режим показа платного доступа. Меняется на лету, без перезапуска. Премиум-пользователи не упираются в paywall ни в каком режиме."
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 96,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {OPTIONS.map((opt) => {
            const active = mode === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !saving && !active && save(opt.value)}
                disabled={saving}
                aria-pressed={active}
                style={{
                  textAlign: 'left',
                  background: active ? 'rgba(161,255,74,0.08)' : 'var(--color-surface)',
                  border: `1px solid ${active ? 'var(--border-lime)' : 'var(--border-hairline)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center shrink-0"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      border: `2px solid ${active ? 'var(--color-brand)' : 'var(--color-muted)'}`,
                      background: active ? 'var(--color-brand)' : 'transparent',
                    }}
                  >
                    {active && <Check size={12} strokeWidth={3} color="var(--color-night)" aria-hidden />}
                  </span>
                  <Icon
                    size={20}
                    style={{ color: active ? 'var(--color-brand)' : 'var(--color-muted)', flexShrink: 0 }}
                    aria-hidden
                  />
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: active ? 'var(--color-brand)' : 'var(--color-ink)',
                    }}
                  >
                    {opt.title}
                  </span>
                </div>
                <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}

          <StatusMsg msg={msg} />

          {/* Цены подписки */}
          <AdminCard style={{ marginTop: 12 }}>
            <SectionTitle icon={CreditCard}>Цены подписки</SectionTitle>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              Отображаются в окне оформления. Годовой тариф пока не используется.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { lbl: 'Цена ₽/мес', val: priceMonthly, set: setPriceMonthly, min: 1, max: 1000000 },
                { lbl: 'Скидка по промо, %', val: discount, set: setDiscount, min: 0, max: 100 },
                { lbl: 'Интро, мес', val: months, set: setMonths, min: 0, max: 36 },
              ].map((f) => (
                <div key={f.lbl}>
                  <label style={labelStyle}>{f.lbl}</label>
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: 13, marginTop: 16 }}>
              Со скидкой:{' '}
              <b style={{ color: 'var(--color-brand)' }}>
                {Number.isFinite(introPreview) ? introPreview : '—'} ₽/мес
              </b>{' '}
              на первые {months} мес.
            </div>
            <StatusMsg msg={priceMsg} />
            <div style={{ marginTop: 16 }}>
              <AdminButton type="button" icon={Save} onClick={savePricing} disabled={savingPrice}>
                {savingPrice ? 'Сохраняю…' : 'Сохранить цены'}
              </AdminButton>
            </div>
          </AdminCard>

          {/* Пробный период для ВСЕХ новых (правка владельца «конец августа»).
              Держать в согласии с офертой: legal/offer обещает 7 дней. */}
          <AdminCard>
            <SectionTitle icon={Gift}>Пробный период</SectionTitle>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              Сколько дней премиума получает КАЖДЫЙ новый пользователь при регистрации.
              0 — выключить. Если человек пришёл по промокоду со своим пробным периодом,
              берётся больший из двух (дни не складываются).
            </div>
            <label style={labelStyle}>Дней премиума новым</label>
            <input
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              style={{ ...inputStyle, maxWidth: 160 }}
            />
            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8 }}>
              {Number(trialDays) > 0
                ? `Новый пользователь сразу получает ${trialDays} дн. полного доступа.`
                : 'Пробный период выключен — новые пользователи сразу упираются в paywall.'}
            </div>
            <StatusMsg msg={trialMsg} />
            <div style={{ marginTop: 16 }}>
              <AdminButton type="button" icon={Save} onClick={saveTrial} disabled={savingTrial}>
                {savingTrial ? 'Сохраняю…' : 'Сохранить пробный период'}
              </AdminButton>
            </div>
          </AdminCard>

          {/* Касса: боевая / тестовая */}
          <AdminCard
            style={{
              border: `1px solid ${payMode === 'test' ? 'rgba(255,140,74,0.5)' : 'var(--border-hairline)'}`,
            }}
          >
            <SectionTitle icon={payMode === 'test' ? FlaskConical : Banknote}>Касса</SectionTitle>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              Через какой терминал T-Bank идут оплаты. Ключи задаются в .env.production
              (TBANK_* — боевая, TBANK_TEST_* — тестовая) и здесь не хранятся. Тестовые оплаты
              помечаются и не считаются реальными: в карточке пользователя не появится «Премиум»
              за оплату, а интро-периоды не расходуются.
            </div>

            <div className="flex flex-col gap-2" style={{ marginBottom: 16 }}>
              {(
                [
                  ['live', 'Боевая касса', 'Реальные деньги'],
                  ['test', 'Тестовая касса', 'Тестовые карты T-Bank, деньги не списываются'],
                ] as const
              ).map(([value, title, desc]) => {
                const t = terminals[value];
                const active = payMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchPayMode(value)}
                    disabled={savingPay || (!t?.configured && !active)}
                    aria-pressed={active}
                    className="text-left transition-opacity disabled:opacity-50"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      minHeight: 44,
                      borderRadius: 'var(--radius-md)',
                      cursor: savingPay || (!t?.configured && !active) ? 'default' : 'pointer',
                      background: active
                        ? value === 'test'
                          ? 'rgba(255,140,74,0.12)'
                          : 'var(--lime-subtle)'
                        : 'transparent',
                      border: `1px solid ${
                        active
                          ? value === 'test'
                            ? 'rgba(255,140,74,0.5)'
                            : 'var(--border-lime)'
                          : 'var(--border-hairline)'
                      }`,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        flexShrink: 0,
                        border: `2px solid ${
                          active
                            ? value === 'test'
                              ? 'var(--color-danger)'
                              : 'var(--color-brand)'
                            : 'var(--color-muted)'
                        }`,
                        background: active
                          ? value === 'test'
                            ? 'var(--color-danger)'
                            : 'var(--color-brand)'
                          : 'transparent',
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        {t?.configured
                          ? `${desc} · терминал ${t.terminalKey}`
                          : 'Ключи не заданы в .env.production'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {payMode === 'test' && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,140,74,0.12)',
                  color: 'var(--color-danger)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                <span>
                  Сейчас деньги НЕ принимаются: все оплаты уходят на тестовый терминал.
                  Не забудь вернуть боевую кассу после проверки.
                </span>
              </div>
            )}

            {payMsg && (
              <div
                style={{
                  fontSize: 13,
                  color: payMsg.type === 'ok' ? 'var(--color-brand)' : 'var(--color-danger)',
                }}
              >
                {payMsg.text}
              </div>
            )}
          </AdminCard>

          {/* Чек 54-ФЗ */}
          <AdminCard
            style={{
              border: `1px solid ${rcEnabled || rcEnabledTest ? 'var(--border-lime)' : 'var(--border-hairline)'}`,
            }}
          >
            <SectionTitle icon={ReceiptText}>Чеки 54-ФЗ</SectionTitle>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              Чек (объект Receipt) уходит в банк вместе с платежом. Флаги раздельные: на боевой
              кассе включай, только когда подключена облачная касса «Чеки от Т-Бизнеса» и бухгалтер
              подтвердил систему налогообложения. На тестовой — включай смело, это нужно для
              тест-кейса T-Bank «Формирование чека».
            </div>

            <div className="flex flex-col gap-2" style={{ marginBottom: 16 }}>
              {(
                [
                  ['live', 'Чек на боевой кассе', rcEnabled, setRcEnabled],
                  ['test', 'Чек на тестовой кассе', rcEnabledTest, setRcEnabledTest],
                ] as const
              ).map(([kind, title, value, setValue]) => (
                <label
                  key={kind}
                  className="flex items-center gap-3 cursor-pointer"
                  style={{
                    minHeight: 44,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: payMode === kind ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: `1px solid ${payMode === kind ? 'var(--border-hairline)' : 'transparent'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setValue(e.target.checked)}
                    disabled={savingRc}
                    style={{ width: 20, height: 20, accentColor: 'var(--color-brand)', cursor: 'pointer' }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{title}</span>
                    {payMode === kind && (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                        Эта касса сейчас принимает оплаты
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Налогообложение</label>
                <select
                  value={rcTaxation}
                  onChange={(e) => setRcTaxation(e.target.value)}
                  disabled={savingRc}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                >
                  <option value="usn_income">УСН Доходы</option>
                  <option value="usn_income_outcome">УСН Доходы−Расходы</option>
                  <option value="osn">ОСН (общая)</option>
                  <option value="patent">Патент</option>
                  <option value="envd">ЕНВД</option>
                  <option value="esn">ЕСХН</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ставка НДС</label>
                <select
                  value={rcVat}
                  onChange={(e) => setRcVat(e.target.value)}
                  disabled={savingRc}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                >
                  <option value="none">Без НДС (УСН)</option>
                  <option value="vat0">0%</option>
                  <option value="vat10">10%</option>
                  <option value="vat20">20%</option>
                  <option value="vat110">10/110</option>
                  <option value="vat120">20/120</option>
                </select>
              </div>
            </div>

            <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
              Чек уходит на email покупателя. Позиция: услуга, полный расчёт, сумма чека равна сумме платежа.
            </div>

            <StatusMsg msg={rcMsg} />

            <div style={{ marginTop: 16 }}>
              <AdminButton type="button" icon={Save} onClick={saveReceipt} disabled={savingRc}>
                {savingRc ? 'Сохраняю…' : 'Сохранить настройки чека'}
              </AdminButton>
            </div>
          </AdminCard>

          {/* Бесплатное занятие недели */}
          <AdminCard>
            <SectionTitle icon={Gift}>Бесплатное занятие недели</SectionTitle>
            <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
              Это видео открыто всем даже при включённом paywall. Меняй раз в неделю.
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-night)',
                border: '1px solid var(--border-hairline)',
                marginBottom: 16,
              }}
            >
              <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>Сейчас выбрано:</div>
              <div
                style={{
                  color: freeLesson ? 'var(--color-brand)' : 'var(--color-muted)',
                  fontSize: 14,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {freeLesson ? freeLesson.title : '— не задано (все видео платные) —'}
              </div>
            </div>

            <label style={labelStyle}>Видео</label>
            <select
              value={pickedVideoId}
              onChange={(e) => setPickedVideoId(e.target.value)}
              disabled={savingLesson}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            >
              <option value="">— выбрать видео —</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>

            <StatusMsg msg={lessonMsg} />

            <div className="flex gap-3 flex-wrap" style={{ marginTop: 16 }}>
              <AdminButton
                type="button"
                icon={Save}
                onClick={() => pickedVideoId && saveFreeLesson(pickedVideoId)}
                disabled={savingLesson || !pickedVideoId}
              >
                {savingLesson ? 'Сохраняю…' : 'Назначить'}
              </AdminButton>
              {freeLesson && (
                <AdminButton
                  type="button"
                  tone="secondary"
                  icon={X}
                  onClick={() => saveFreeLesson('')}
                  disabled={savingLesson}
                >
                  Снять
                </AdminButton>
              )}
            </div>
          </AdminCard>

          <AdminCard tone="accent">
            <div className="flex items-start gap-3">
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(161,255,74,0.12)' }}
              >
                <Lightbulb size={20} style={{ color: 'var(--color-brand)' }} aria-hidden />
              </span>
              <div style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.5 }}>
                «Только админы» — для обкатки в проде: отметь нужные аккаунты как админов
                (<Link href="/admin/admins" style={{ color: 'var(--color-brand)' }}>Администраторы</Link>) и
                переключи сюда. Премиум им выдаётся вручную на странице{' '}
                <Link href="/admin/users" style={{ color: 'var(--color-brand)' }}>Пользователи</Link>.
              </div>
            </div>
          </AdminCard>
        </div>
      )}
    </AdminPage>
  );
}
