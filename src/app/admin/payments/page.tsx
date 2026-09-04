'use client';

// Платежи обеих касс: статус, сумма, кто платил, выдан ли премиум, возврат.
// Кнопка «Вернуть» — полный возврат через T-Bank Cancel (тест-кейсы банка 3 и
// 8, реальные возвраты); премиум по заказу откатывается автоматически.

import { useCallback, useEffect, useState } from 'react';
import { AdminPage, PageHeader, AdminCard, AdminButton, EmptyState } from '@/components/admin/ui';
import { CreditCard, RefreshCw, Undo2, FlaskConical, Crown } from 'lucide-react';

interface PaymentRow {
  id: string;
  orderId: string;
  paymentId: string | null;
  status: string;
  kind: string;
  amountKopecks: number;
  isTest: boolean;
  errorCode: string | null;
  premiumGrantedAt: string | null;
  refundedAt: string | null;
  refundAmountKopecks: number | null;
  createdAt: string;
  user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
}

const REFUNDABLE = new Set(['NEW', 'FORM_SHOWED', 'AUTHORIZED', 'CONFIRMED']);
const DONE = new Set(['CANCELED', 'REVERSED', 'REFUNDED']);

function statusTone(s: string): React.CSSProperties {
  if (s === 'CONFIRMED') return { color: 'var(--color-brand)', background: 'var(--lime-subtle)', border: '1px solid var(--border-lime)' };
  if (DONE.has(s) || s.startsWith('PARTIAL')) return { color: 'var(--color-danger)', background: 'rgba(255,140,74,0.12)', border: '1px solid rgba(255,140,74,0.4)' };
  if (s === 'REJECTED') return { color: 'var(--color-danger)', background: 'transparent', border: '1px solid rgba(255,140,74,0.4)' };
  return { color: 'var(--color-muted)', background: 'transparent', border: '1px solid var(--border-hairline)' };
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const rub = (k: number) => `${(k / 100).toLocaleString('ru-RU')} ₽`;

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payments?limit=200', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || 'Ошибка загрузки');
      setRows(d.payments || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refund = async (p: PaymentRow) => {
    const who = p.user.email || p.user.id;
    if (
      !window.confirm(
        `Вернуть ${rub(p.amountKopecks)} по заказу ${p.orderId} (${who})?${
          p.isTest ? '\nЭто ТЕСТОВАЯ касса, деньги не настоящие.' : '\nДеньги уйдут покупателю, премиум за этот период снимется.'
        }`,
      )
    ) {
      return;
    }
    setBusy(p.orderId);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${encodeURIComponent(p.orderId)}/refund`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'err', text: d?.error || 'Не удалось вернуть' });
        return;
      }
      setMsg({
        type: 'ok',
        text: `Возврат проведён: статус ${d.status}, ${rub(d.refundedKopecks ?? p.amountKopecks)}${
          d.premiumRevoked ? `, премиум откачен${d.premiumUntil ? ` до ${fmtDate(d.premiumUntil)}` : ' (снят)'}` : ''
        }`,
      });
      await load();
    } catch {
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminPage width="wide">
      <PageHeader
        title="Платежи"
        icon={CreditCard}
        backHref="/admin"
        subtitle="Обе кассы T-Bank. «Вернуть» — полный возврат через банк; выданный за этот заказ период премиума снимается автоматически. Возврат из кабинета банка тоже подхватывается вебхуком."
        actions={
          <AdminButton tone="secondary" size="sm" icon={RefreshCw} onClick={() => void load()}>
            Обновить
          </AdminButton>
        }
      />

      {msg && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            fontWeight: 600,
            color: msg.type === 'ok' ? 'var(--color-brand)' : 'var(--color-danger)',
            background: msg.type === 'ok' ? 'var(--lime-subtle)' : 'rgba(255,140,74,0.12)',
          }}
        >
          {msg.text}
        </div>
      )}

      {error && <EmptyState title={`Не удалось загрузить: ${error}`} />}
      {!rows && !error && <div style={{ color: 'var(--color-muted)', padding: 24 }}>Загрузка…</div>}
      {rows && rows.length === 0 && <EmptyState title="Платежей пока нет" />}

      {rows && rows.length > 0 && (
        <AdminCard style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--color-muted)', textAlign: 'left' }}>
                {['Когда', 'Кто', 'Сумма', 'Статус', 'Касса', 'Премиум', 'Возврат', ''].map((h, i) => (
                  <th key={i} style={{ padding: '12px 14px', fontWeight: 600, borderBottom: '1px solid var(--border-hairline)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const canRefund = REFUNDABLE.has(p.status) && !!p.paymentId && !p.refundedAt;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div>{fmtDate(p.createdAt)}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>{p.orderId}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div>{[p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || '—'}</div>
                      <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>{p.user.email || p.user.id}</div>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 700 }}>{rub(p.amountKopecks)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ ...statusTone(p.status), padding: '3px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {p.status}
                      </span>
                      {p.errorCode && p.errorCode !== '0' && (
                        <div style={{ color: 'var(--color-danger)', fontSize: 11, marginTop: 4 }}>код {p.errorCode}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {p.isTest ? (
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 700 }}>
                          <FlaskConical size={14} aria-hidden /> тест
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>боевая</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {p.premiumGrantedAt ? (
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-brand)', fontSize: 12, fontWeight: 700 }}>
                          <Crown size={14} aria-hidden /> выдан
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {p.refundedAt ? (
                        <span style={{ color: 'var(--color-danger)' }}>
                          {fmtDate(p.refundedAt)}
                          {p.refundAmountKopecks != null ? ` · ${rub(p.refundAmountKopecks)}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {canRefund && (
                        <AdminButton
                          tone="danger"
                          size="sm"
                          icon={Undo2}
                          disabled={busy === p.orderId}
                          onClick={() => void refund(p)}
                          title={p.status === 'CONFIRMED' ? 'Полный возврат денег' : 'Отмена неоплаченного/холда'}
                        >
                          {busy === p.orderId ? 'Возвращаю…' : p.status === 'CONFIRMED' ? 'Вернуть' : 'Отменить'}
                        </AdminButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminCard>
      )}
    </AdminPage>
  );
}
