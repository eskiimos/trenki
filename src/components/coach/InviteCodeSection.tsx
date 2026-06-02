'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/lib/coach/use-toast';

interface Team {
  id: string;
  name: string;
  inviteCode: string;
}

/**
 * Блок «Код приглашения» для тренера. Показывает код и ссылку,
 * умеет копировать, шарить через Web Share API и регенерировать код.
 *
 * Раньше жил в /coach/team; перенесён в /coach/profile.
 */
export default function InviteCodeSection() {
  const toast = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const first = data.teams?.[0];
      if (first) {
        setTeam({ id: first.id, name: first.name, inviteCode: first.inviteCode });
      }
    } catch (e) {
      console.error('InviteCodeSection load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inviteUrl = team
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://trenki.app'}/join/${team.inviteCode}`
    : '';

  const handleCopyCode = async () => {
    if (!team) return;
    try {
      await navigator.clipboard?.writeText(team.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
      toast.show('Код скопирован', 'success');
    } catch {
      toast.show('Не удалось скопировать', 'error');
    }
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
      toast.show('Ссылка скопирована', 'success');
    } catch {
      toast.show('Не удалось скопировать', 'error');
    }
  };

  const handleShare = async () => {
    if (!team || !inviteUrl) return;
    const text = `Присоединяйся к команде «${team.name}» в Треньки. После твоей заявки тренер подтвердит вступление.`;
    type ShareNav = Navigator & { share?: (d: ShareData) => Promise<void> };
    const nav = navigator as ShareNav;
    if (nav.share) {
      try { await nav.share({ title: 'Команда', text, url: inviteUrl }); } catch { /* user cancelled */ }
    } else {
      handleCopyLink();
    }
  };

  const handleRegenerate = async () => {
    if (!team) return;
    if (!confirm('Сгенерировать новый код? Старый перестанет работать.')) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/regenerate-code`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTeam((prev) => prev ? { ...prev, inviteCode: data.team.inviteCode } : prev);
        toast.show('Новый код создан', 'success');
      } else {
        toast.show('Ошибка генерации', 'error');
      }
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div
        className="mt-5"
        style={{
          background: '#060919',
          border: '1px solid #26252F',
          borderRadius: 14,
          padding: '14px 16px',
          height: 152,
        }}
      >
        <div className="skeleton-loading" style={{ width: '60%', height: 14, borderRadius: 4 }} />
        <div className="skeleton-loading mt-3" style={{ width: '40%', height: 22, borderRadius: 4 }} />
        <div className="skeleton-loading mt-4" style={{ width: '100%', height: 36, borderRadius: 999 }} />
      </div>
    );
  }

  if (!team) {
    return (
      <div
        className="mt-5 text-center py-6 font-overpass"
        style={{
          color: '#AEABBB',
          fontSize: 13,
          background: '#060919',
          borderRadius: 14,
          border: '1px dashed #26252F',
        }}
      >
        У тебя пока нет команды.
      </div>
    );
  }

  return (
    <div
      className="mt-5"
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      {/* Код */}
      <div className="flex items-center justify-between">
        <div>
          <div
            className="font-overpass uppercase"
            style={{ color: '#9B99AA', fontWeight: 700, fontSize: 10, letterSpacing: '0.5px' }}
          >
            Код приглашения
          </div>
          <div
            className="font-overpass"
            style={{ color: '#A1FF4A', fontWeight: 900, fontSize: 22, letterSpacing: '0.25em', marginTop: 2 }}
          >
            {team.inviteCode}
          </div>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="font-overpass uppercase transition-transform duration-100 active:scale-95"
          style={{
            background: '#A1FF4A',
            color: '#101530',
            borderRadius: 999,
            padding: '10px 14px',
            fontWeight: 900,
            fontSize: 11,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Поделиться
        </button>
      </div>

      {/* Ссылка */}
      <div
        className="mt-3"
        style={{
          background: '#101530',
          border: '1px solid #26252F',
          borderRadius: 10,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          className="flex-1 font-overpass truncate"
          style={{ color: '#AEABBB', fontSize: 12 }}
        >
          {inviteUrl}
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="font-overpass uppercase transition-transform duration-100 active:scale-95"
          style={{
            background: linkCopied ? '#A1FF4A' : 'transparent',
            color: linkCopied ? '#101530' : '#A1FF4A',
            border: linkCopied ? 'none' : '1px solid rgba(161, 255, 74, 0.4)',
            borderRadius: 999,
            padding: '5px 10px',
            fontWeight: 800,
            fontSize: 9,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {linkCopied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      {/* Действия */}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex-1 font-overpass uppercase transition-transform duration-100 active:scale-95"
          style={{
            background: codeCopied ? '#A1FF4A' : 'transparent',
            color: codeCopied ? '#101530' : '#F9F8FE',
            border: codeCopied ? 'none' : '1px solid #26252F',
            borderRadius: 999,
            padding: '8px 12px',
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          {codeCopied ? 'Код скопирован' : 'Копировать код'}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="font-overpass uppercase transition-transform duration-100 active:scale-95"
          style={{
            background: 'transparent',
            color: '#AEABBB',
            border: '1px solid #26252F',
            borderRadius: 999,
            padding: '8px 12px',
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: '0.05em',
            cursor: regenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {regenerating ? '...' : 'Новый код'}
        </button>
      </div>

      <div
        className="font-overpass mt-3"
        style={{ color: '#9B99AA', fontSize: 11, lineHeight: '140%' }}
      >
        После того как игрок введёт код или откроет ссылку — заявка появится
        в твоём списке. Доступ к команде даётся только после подтверждения.
      </div>
    </div>
  );
}
