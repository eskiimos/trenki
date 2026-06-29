'use client';

// Админ-дашборд реферальных каналов. Доступ проверяет admin/layout.tsx.
// Список кодов + статистика + создание + ссылка-копипаст + дрилл-даун по
// пользователям + выгрузка CSV.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface RefUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  onboarded: boolean;
  createdAt: string;
  lastActivity: string;
}
interface RefCode {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  stats: { registrations: number; onboarded: number; active7d: number };
  users: RefUser[];
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
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Ошибка');
      setCodes(d.codes || []);
      setStats(d.stats || null);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Ошибка');
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
        body: JSON.stringify({ code: newCode, label: newLabel, note: newNote || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d?.error || 'Ошибка'); return; }
      setNewCode(''); setNewLabel(''); setNewNote('');
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
    const esc = (s: any) => {
      let v = String(s ?? '');
      // CSV-инъекция: если ячейка начинается с =,+,-,@,Tab,CR — нейтрализуем
      // ведущей кавычкой (имя/почта приходят от пользователя).
      if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const header = ['Имя', 'Email', 'Роль', 'Онбординг', 'Регистрация', 'Последняя активность'];
    const rows = c.users.map((u) => [
      u.name, u.email || '', u.role, u.onboarded ? 'да' : 'нет',
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

  return (
    <div className="min-h-screen bg-[#060919] text-white p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">🔗 Реферальные каналы</h1>
        <Link href="/admin" className="text-sm text-[#A1FF4A] hover:underline">← В админку</Link>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[['Каналов', stats.total], ['Активных', stats.active], ['Всего регистраций', stats.totalRegistrations]].map(([t, v]) => (
            <div key={t as string} className="bg-[#101530] rounded-xl p-4">
              <div className="text-gray-400 text-xs">{t}</div>
              <div className="text-2xl font-bold text-[#A1FF4A]">{v as number}</div>
            </div>
          ))}
        </div>
      )}

      {/* Создание кода */}
      <div className="bg-[#101530] rounded-xl p-4 mb-6">
        <div className="text-sm font-semibold mb-3">Новый канал</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="код (igls26)"
            autoCapitalize="none" spellCheck={false}
            className="bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A1FF4A]" />
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="название (ИГЛС)"
            className="bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A1FF4A]" />
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="заметка (необязательно)"
            className="bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#A1FF4A]" />
        </div>
        <button onClick={create} disabled={busy || !newCode.trim() || !newLabel.trim()}
          className="bg-[#A1FF4A] text-[#060919] font-bold text-sm rounded-lg px-4 py-2 disabled:opacity-50">
          Создать
        </button>
        <div className="text-gray-500 text-xs mt-2">Код — латиница/цифры/_/- (без кириллицы). Ссылка: {origin}/r/&lt;код&gt;</div>
      </div>

      {err && <div className="text-red-400 text-sm mb-4">{err}</div>}
      {loading && <div className="text-gray-400 text-sm">Загрузка…</div>}

      <div className="flex flex-col gap-3">
        {codes.map((c) => (
          <div key={c.id} className="bg-[#101530] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{c.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.isActive ? 'rgba(161,255,74,0.18)' : 'rgba(174,171,187,0.18)', color: c.isActive ? '#A1FF4A' : '#AEABBB' }}>
                    {c.isActive ? 'активен' : 'выкл'}
                  </span>
                </div>
                <div className="text-gray-400 text-xs mt-1 font-mono">{c.code}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#A1FF4A] font-bold">{c.stats.registrations}</span><span className="text-gray-500">рег.</span>
                <span className="text-gray-300">{c.stats.onboarded}</span><span className="text-gray-500">онб.</span>
                <span className="text-gray-300">{c.stats.active7d}</span><span className="text-gray-500">акт.7д</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={() => copy(linkFor(c.code), `link-${c.id}`)} className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-1.5 hover:border-[#A1FF4A]">
                {copied === `link-${c.id}` ? '✓ скопировано' : '🔗 копировать ссылку'}
              </button>
              <button onClick={() => copy(c.code, `code-${c.id}`)} className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-1.5 hover:border-[#A1FF4A]">
                {copied === `code-${c.id}` ? '✓' : '📋 код'}
              </button>
              <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-1.5 hover:border-[#A1FF4A]">
                {expanded === c.id ? 'скрыть' : `👥 кто пришёл (${c.stats.registrations})`}
              </button>
              <button onClick={() => exportCsv(c)} disabled={c.users.length === 0} className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-1.5 hover:border-[#A1FF4A] disabled:opacity-40">⬇️ CSV</button>
              <button onClick={() => toggle(c)} disabled={busy} className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-1.5 hover:border-[#A1FF4A]">{c.isActive ? 'выключить' : 'включить'}</button>
              <button onClick={() => remove(c)} disabled={busy} className="text-xs text-red-400 border border-red-500/40 rounded-lg px-3 py-1.5 hover:bg-red-500/10">удалить</button>
            </div>

            {expanded === c.id && (
              <div className="mt-3 overflow-x-auto">
                {c.users.length === 0 ? (
                  <div className="text-gray-500 text-xs py-2">Пока никто не зарегистрировался по этому коду.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="py-1 pr-2">Имя</th><th className="py-1 pr-2">Email</th><th className="py-1 pr-2">Роль</th>
                        <th className="py-1 pr-2">Онб.</th><th className="py-1 pr-2">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.users.map((u) => (
                        <tr key={u.id} className="border-t border-[#2a2f4a]">
                          <td className="py-1.5 pr-2">{u.name}</td>
                          <td className="py-1.5 pr-2 text-gray-400">{u.email || '—'}</td>
                          <td className="py-1.5 pr-2 text-gray-400">{u.role === 'COACH' ? 'тренер' : 'атлет'}</td>
                          <td className="py-1.5 pr-2">{u.onboarded ? '✓' : '—'}</td>
                          <td className="py-1.5 pr-2 text-gray-400">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
        {!loading && codes.length === 0 && <div className="text-gray-500 text-sm">Каналов пока нет — создай первый выше.</div>}
      </div>
    </div>
  );
}
