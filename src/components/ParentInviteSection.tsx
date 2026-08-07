'use client';

// Секция «Родителям» в профиле ребёнка: список привязанных родителей
// (с запросом на отвязку — рвёт связь родитель в кабинете) + генерация
// ссылки-приглашения (POST /api/parent/invite).
// Вынесена из profile/page.tsx, чтобы не раздувать страницу.

import { useEffect, useState } from 'react';

interface LinkedParent {
  linkId: string;
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  unlinkRequestedAt: string | null;
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

  // Ребёнок не рвёт связь сам — только просит. Родитель подтверждает в кабинете.
  const handleRequestUnlink = async (linkId: string) => {
    if (
      !confirm(
        'Запросить отвязку? Родитель получит запрос и должен подтвердить его в своём кабинете.',
      )
    )
      return;
    try {
      const res = await fetch('/api/parent/unlink-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ linkId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setParents((prev) =>
          prev.map((p) =>
            p.linkId === linkId
              ? { ...p, unlinkRequestedAt: data.unlinkRequestedAt || new Date().toISOString() }
              : p,
          ),
        );
      }
    } catch {
      // тихо: состояние не изменится, юзер повторит
    }
  };

  const handleCancelUnlinkRequest = async (linkId: string) => {
    try {
      const res = await fetch(`/api/parent/unlink-request?linkId=${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setParents((prev) =>
          prev.map((p) => (p.linkId === linkId ? { ...p, unlinkRequestedAt: null } : p)),
        );
      }
    } catch {
      // тихо: состояние не изменится, юзер повторит
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
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-medium truncate">{parentName(p)}</div>
                      {p.email && <div className="text-muted text-xs truncate">{p.email}</div>}
                    </div>
                    {!p.unlinkRequestedAt && (
                      <button
                        type="button"
                        onClick={() => handleRequestUnlink(p.linkId)}
                        className="text-red-400 text-xs font-medium font-overpass uppercase tracking-wide shrink-0 ml-3 hover:text-red-300 transition-colors"
                      >
                        Запросить отвязку
                      </button>
                    )}
                  </div>
                  {p.unlinkRequestedAt && (
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-300 text-[11px] font-medium rounded-full px-2.5 py-1">
                        <span aria-hidden>⏳</span>
                        Запрос отправлен, ждёт родителя
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelUnlinkRequest(p.linkId)}
                        className="text-muted text-xs font-medium font-overpass uppercase tracking-wide shrink-0 hover:text-white transition-colors"
                      >
                        Отменить запрос
                      </button>
                    </div>
                  )}
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
