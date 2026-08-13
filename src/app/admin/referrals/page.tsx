'use client';

// Админ-дашборд реферальных каналов. Доступ проверяет admin/layout.tsx.
// Список кодов + статистика + создание + ссылка-копипаст + дрилл-даун по
// пользователям + выгрузка CSV.

import { useEffect, useState, useCallback } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  Kpi,
  EmptyState,
  inputStyle,
} from '@/components/admin/ui';
import {
  Link2,
  Plus,
  Copy,
  Check,
  Users,
  Download,
  Power,
  PowerOff,
  Trash2,
  Gift,
  Star,
  UserPlus,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface RefUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  onboarded: boolean;
  premium: boolean;
  createdAt: string;
  lastActivity: string;
}
interface RefCode {
  id: string;
  code: string;
  label: string;
  aliases: string[];
  isActive: boolean;
  note: string | null;
  trialDays: number;
  createdAt: string;
  stats: { registrations: number; onboarded: number; active7d: number; premium: number };
  users: RefUser[];
}

/** Компактная метрика в карточке канала: значение над подписью. */
function MiniStat({
  icon: Icon,
  value,
  label,
  accent,
  title,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  accent?: string;
  title?: string;
}) {
  return (
    <div title={title}>
      <div className="flex items-center gap-1" style={{ color: accent ?? 'var(--color-ink)' }}>
        <Icon size={16} aria-hidden />
        <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function AdminReferralsPage() {
  const [codes, setCodes] = useState<RefCode[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; totalRegistrations: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // форма создания
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [newTrial, setNewTrial] = useState('0');
  const [copied, setCopied] = useState<string | null>(null);
  // Черновики поля «триал» по каждому коду (ключ — id). Пусто — показываем текущее.
  const [trialEdit, setTrialEdit] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Ошибка');
      setCodes(d.codes || []);
      setStats(d.stats || null);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (code: string) => `${origin}/r/${code}`;

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const create = async () => {
    if (!newCode.trim() || !newLabel.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, label: newLabel, note: newNote || undefined, aliases: newAliases || undefined, trialDays: Number(newTrial) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d?.error || 'Ошибка'); return; }
      setNewCode(''); setNewLabel(''); setNewNote(''); setNewAliases(''); setNewTrial('0');
      await load();
    } finally { setBusy(false); }
  };

  // Сохранить пробный период по коду. Валидируем на клиенте (сервер тоже проверит).
  const saveTrial = async (c: RefCode) => {
    const raw = trialEdit[c.id];
    if (raw === undefined) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 365) { alert('Триал — целое от 0 до 365 дней'); return; }
    if (n === c.trialDays) { setTrialEdit((m) => { const { [c.id]: _, ...rest } = m; return rest; }); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, trialDays: n }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d?.error || 'Ошибка'); return; }
      setTrialEdit((m) => { const { [c.id]: _, ...rest } = m; return rest; });
      await load();
    } finally { setBusy(false); }
  };

  const toggle = async (c: RefCode) => {
    setBusy(true);
    try {
      await fetch('/api/admin/referrals', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, isActive: !c.isActive }),
      });
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (c: RefCode) => {
    if (!confirm(`Удалить код «${c.code}» (${c.label})? Привязки уже зарегистрированных останутся.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/referrals?id=${c.id}`, { method: 'DELETE' });
      await load();
    } finally { setBusy(false); }
  };

  const exportCsv = (c: RefCode) => {
    const esc = (s: unknown) => {
      let v = String(s ?? '');
      // CSV-инъекция: если ячейка начинается с =,+,-,@,Tab,CR — нейтрализуем
      // ведущей кавычкой (имя/почта приходят от пользователя).
      if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const header = ['Имя', 'Email', 'Роль', 'Онбординг', 'Премиум', 'Регистрация', 'Последняя активность'];
    const rows = c.users.map((u) => [
      u.name, u.email || '', u.role, u.onboarded ? 'да' : 'нет', u.premium ? 'да' : 'нет',
      new Date(u.createdAt).toISOString().slice(0, 10),
      new Date(u.lastActivity).toISOString().slice(0, 10),
    ].map(esc).join(','));
    const csv = '﻿' + [header.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `referral_${c.code}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const smallInput: React.CSSProperties = {
    ...inputStyle,
    minHeight: 40,
    padding: '8px 12px',
    fontSize: 13,
  };

  return (
    <AdminPage>
      <PageHeader title="Реферальные каналы" icon={Link2} backHref="/admin" />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginBottom: 24 }}>
          <Kpi icon={Link2} label="Каналов" value={stats.total} />
          <Kpi icon={Power} label="Активных" value={stats.active} />
          <Kpi icon={UserPlus} label="Всего регистраций" value={stats.totalRegistrations} accent />
        </div>
      )}

      {/* Создание кода */}
      <AdminCard style={{ marginBottom: 24 }}>
        <SectionTitle icon={Plus}>Новый канал</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="код (igls26)"
            autoCapitalize="none" spellCheck={false} style={smallInput} />
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="название (ИГЛС)"
            style={smallInput} />
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="заметка (необязательно)"
            style={smallInput} />
        </div>
        <input value={newAliases} onChange={(e) => setNewAliases(e.target.value)} placeholder="промокоды для ручного ввода через запятую (напр. ИГЛС, иглс)"
          style={{ ...smallInput, marginBottom: 12 }} />
        <div className="flex items-center flex-wrap gap-2" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Пробный период:</span>
          <input type="number" min={0} max={365} value={newTrial} onChange={(e) => setNewTrial(e.target.value)}
            style={{ ...smallInput, width: 88 }} />
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            дней премиума при регистрации по этому коду (0 — без триала)
          </span>
        </div>
        <AdminButton onClick={create} disabled={busy || !newCode.trim() || !newLabel.trim()} icon={Plus}>
          Создать
        </AdminButton>
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 12, lineHeight: 1.4 }}>
          Код/слаг ссылки — латиница (ссылка {origin}/r/&lt;код&gt;). Промокоды (алиасы) можно кириллицей — по ним пускаем при ручном вводе.
        </div>
      </AdminCard>

      {err && (
        <div style={{ marginBottom: 16 }}>
          <AdminCard tone="danger">
            <div className="flex items-center gap-3" role="status" aria-live="polite">
              <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 14 }}>{err}</span>
            </div>
          </AdminCard>
        </div>
      )}

      {loading && codes.length === 0 ? (
        <div className="flex flex-col" style={{ gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 180,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 12, opacity: loading ? 0.6 : 1 }}>
          {codes.map((c) => (
            <AdminCard key={c.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{c.label}</span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: c.isActive ? 'var(--lime-medium)' : 'rgba(174,171,187,0.18)',
                        color: c.isActive ? 'var(--color-brand)' : 'var(--color-muted)',
                      }}
                    >
                      {c.isActive ? 'активен' : 'выкл'}
                    </span>
                    {c.trialDays > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--blue-medium)',
                          color: 'var(--color-ink)',
                        }}
                        title="Пробный период при регистрации по этому коду"
                      >
                        <Gift size={16} aria-hidden />
                        триал {c.trialDays} дн.
                      </span>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                    {c.code}
                  </div>
                  {c.aliases?.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                      промокоды: {c.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3 shrink-0">
                  <MiniStat icon={UserPlus} value={c.stats.registrations} label="рег." accent="var(--color-brand)" />
                  <MiniStat icon={Check} value={c.stats.onboarded} label="действ." title="Прошёл онбординг — заполнен профиль" />
                  <MiniStat icon={Star} value={c.stats.premium} label="премиум" accent="var(--color-brand)" title="Активная подписка сейчас" />
                  <MiniStat icon={Activity} value={c.stats.active7d} label="акт. 7д" />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 16 }}>
                <AdminButton
                  size="sm"
                  tone="secondary"
                  icon={copied === `link-${c.id}` ? Check : Link2}
                  onClick={() => copy(linkFor(c.code), `link-${c.id}`)}
                >
                  {copied === `link-${c.id}` ? 'скопировано' : 'копировать ссылку'}
                </AdminButton>
                <AdminButton
                  size="sm"
                  tone="secondary"
                  icon={copied === `code-${c.id}` ? Check : Copy}
                  onClick={() => copy(c.code, `code-${c.id}`)}
                >
                  код
                </AdminButton>
                <AdminButton
                  size="sm"
                  tone="secondary"
                  icon={Users}
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  {expanded === c.id ? 'скрыть' : `кто пришёл (${c.stats.registrations})`}
                </AdminButton>
                <AdminButton
                  size="sm"
                  tone="secondary"
                  icon={Download}
                  onClick={() => exportCsv(c)}
                  disabled={c.users.length === 0}
                >
                  CSV
                </AdminButton>
                <AdminButton
                  size="sm"
                  tone="secondary"
                  icon={c.isActive ? PowerOff : Power}
                  onClick={() => toggle(c)}
                  disabled={busy}
                >
                  {c.isActive ? 'выключить' : 'включить'}
                </AdminButton>

                <span className="inline-flex items-center gap-2 ml-auto" style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--color-muted)' }}>триал</span>
                  <input type="number" min={0} max={365}
                    aria-label={`Пробный период по коду ${c.code}, дней`}
                    value={trialEdit[c.id] ?? String(c.trialDays)}
                    onChange={(e) => setTrialEdit((m) => ({ ...m, [c.id]: e.target.value }))}
                    style={{ ...smallInput, width: 72 }} />
                  <span style={{ color: 'var(--color-muted)' }}>дн.</span>
                  {/* Место под кнопку зарезервировано, чтобы строка не дёргалась */}
                  <span style={{ minWidth: 132, display: 'inline-flex' }}>
                    {trialEdit[c.id] !== undefined && trialEdit[c.id] !== String(c.trialDays) && (
                      <AdminButton size="sm" icon={Check} onClick={() => saveTrial(c)} disabled={busy}>
                        сохранить
                      </AdminButton>
                    )}
                  </span>
                  <AdminButton
                    size="sm"
                    tone="danger"
                    icon={Trash2}
                    onClick={() => remove(c)}
                    disabled={busy}
                  >
                    удалить
                  </AdminButton>
                </span>
              </div>

              {expanded === c.id && (
                <div style={{ marginTop: 16 }} className="overflow-x-auto">
                  {c.users.length === 0 ? (
                    <div style={{ fontSize: 14, color: 'var(--color-muted)', padding: '8px 0' }}>
                      Пока никто не зарегистрировался по этому коду.
                    </div>
                  ) : (
                    <table className="w-full min-w-160" style={{ fontSize: 14 }}>
                      <thead>
                        <tr className="text-left" style={{ color: 'var(--color-muted)', fontSize: 12 }}>
                          <th className="py-2 pr-3 font-normal">Имя</th>
                          <th className="py-2 pr-3 font-normal">Email</th>
                          <th className="py-2 pr-3 font-normal">Роль</th>
                          <th className="py-2 pr-3 font-normal">Действ.</th>
                          <th className="py-2 pr-3 font-normal">Премиум</th>
                          <th className="py-2 pr-3 font-normal">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.users.map((u) => (
                          <tr key={u.id} style={{ borderTop: '1px solid var(--border-hairline)' }}>
                            <td className="py-2 pr-3">{u.name}</td>
                            <td className="py-2 pr-3" style={{ color: 'var(--color-muted)' }}>{u.email || '—'}</td>
                            <td className="py-2 pr-3" style={{ color: 'var(--color-muted)' }}>{u.role === 'COACH' ? 'тренер' : 'атлет'}</td>
                            <td className="py-2 pr-3">
                              {u.onboarded
                                ? <Check size={16} style={{ color: 'var(--color-brand)' }} aria-label="да" />
                                : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                            </td>
                            <td className="py-2 pr-3">
                              {u.premium
                                ? <Star size={16} style={{ color: 'var(--color-brand)', fill: 'var(--color-brand)' }} aria-label="да" />
                                : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                            </td>
                            <td className="py-2 pr-3" style={{ color: 'var(--color-muted)' }}>
                              {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </AdminCard>
          ))}
          {!loading && codes.length === 0 && (
            <EmptyState
              icon={Link2}
              title="Каналов пока нет"
              hint="Создай первый канал в форме выше"
            />
          )}
        </div>
      )}
    </AdminPage>
  );
}
