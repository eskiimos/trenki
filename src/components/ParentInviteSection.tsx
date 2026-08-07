'use client';

// Секция «Родителям» в профиле ребёнка: список привязанных родителей
// (с отвязкой) + генерация ссылки-приглашения (POST /api/parent/invite).
// Вынесена из profile/page.tsx, чтобы не раздувать страницу.

import { useEffect, useState } from 'react';

interface LinkedParent {
  linkId: string;
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

interface ActiveInvite {
  code: string;
  url: string;
  expiresAt: string;
}

function parentName(p: LinkedParent): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Родитель';
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ParentInviteSection() {
  const [parents, setParents] = useState<LinkedParent[]>([]);
  const [invite, setInvite] = useState<ActiveInvite | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/parent/invite', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setParents(Array.isArray(d.parents) ? d.parents : []);
        setInvite(d.invite ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/parent/invite', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Не удалось создать приглашение');
        return;
      }
      setInvite({ code: data.code, url: data.url, expiresAt: data.expiresAt });
      setCopied(false);
    } catch {
      setError('Сетевая ошибка. Проверь подключение.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать — выдели ссылку вручную');
    }
  };

  const handleShare = async () => {
    if (!invite) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Треньки — приглашение для родителя',
          text: 'Открой ссылку, чтобы видеть мой прогресс в Треньках',
          url: invite.url,
        });
        return;
      } catch {
        // отмена шаринга — не ошибка
        return;
      }
    }
    handleCopy(); // fallback: просто копируем
  };

  const handleUnlink = async (linkId: string) => {
    if (!confirm('Отвязать родителя? Он перестанет видеть твой прогресс.')) return;
    try {
      const res = await fetch(`/api/parent/invite?linkId=${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setParents((prev) => prev.filter((p) => p.linkId !== linkId));
      }
    } catch {
      // тихо: список не изменится, юзер повторит
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-white/50 text-xs font-medium font-overpass uppercase tracking-wide mb-2 px-1">
        Родителям
      </h2>
      <div className="bg-surface rounded-2xl p-4 border border-white/5">
        {/* Привязанные родители */}
        {parents.length > 0 && (
          <div className="mb-4">
            {parents.map((p, i) => (
              <div key={p.linkId}>
                {i > 0 && <div className="h-[1px] bg-white/5 my-1" />}
                <div className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-medium truncate">{parentName(p)}</div>
                    {p.email && <div className="text-muted text-xs truncate">{p.email}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(p.linkId)}
                    className="text-red-400 text-xs font-medium font-overpass uppercase tracking-wide shrink-0 ml-3 hover:text-red-300 transition-colors"
                  >
                    Отвязать
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {parents.length === 0 && !invite && (
          <p className="text-muted text-xs leading-relaxed mb-3">
            Пригласи родителя — он увидит твой уровень, серию тренировок и потенциал в своём
            кабинете.
          </p>
        )}

        {/* Активная ссылка-приглашение */}
        {invite && (
          <div className="mb-3">
            <div className="bg-night rounded-xl px-3 py-2.5 mb-2 overflow-x-auto">
              <span className="text-brand text-xs font-mono whitespace-nowrap">{invite.url}</span>
            </div>
            <div className="text-muted text-xs mb-3">
              Действует до {formatExpiry(invite.expiresAt)} · одноразовая
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="bg-white/10 text-white text-xs font-bold font-overpass uppercase tracking-wide rounded-full py-2.5 hover:bg-white/15 transition-colors"
              >
                {copied ? '✓ Скопировано' : 'Скопировать'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="bg-brand text-night text-xs font-bold font-overpass uppercase tracking-wide rounded-full py-2.5 hover:opacity-90 transition-opacity"
              >
                Поделиться
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs mb-3 text-center">{error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className={`w-full text-xs font-bold font-overpass uppercase tracking-wide rounded-full py-2.5 transition-colors disabled:opacity-50 ${
            invite ? 'bg-white/10 text-muted hover:bg-white/15' : 'bg-brand text-night hover:opacity-90'
          }`}
        >
          {creating ? 'Создаём…' : invite ? 'Создать новую ссылку' : 'Пригласить родителя'}
        </button>
      </div>
    </div>
  );
}
