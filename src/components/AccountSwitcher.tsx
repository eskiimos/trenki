'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAccounts,
  setActiveAccount,
  removeAccount,
  markAddingAccount,
  MAX_ACCOUNTS,
} from '@/lib/multi-account';
import type { AuthData } from '@/lib/auth';

interface Props {
  /** Если задано — компонент скрывается, когда аккаунт всего один. */
  hideWhenSingle?: boolean;
}

/**
 * Переключатель мульти-аккаунтов (как в Instagram).
 * Показывает список сохранённых аккаунтов, позволяет переключаться между ними,
 * добавлять новый и удалять отдельный аккаунт из списка.
 */
export default function AccountSwitcher({ hideWhenSingle = false }: Props) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AuthData[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setAccounts(getAccounts());
  }, []);

  if (hideWhenSingle && accounts.length <= 1) return null;
  if (accounts.length === 0) return null;

  const active = accounts[0];
  const others = accounts.slice(1);

  const handleSwitch = (telegramId: string) => {
    const ok = setActiveAccount(telegramId);
    if (ok) {
      // Полный reload, чтобы все запросы пошли с новой cookie
      window.location.href = '/';
    }
  };

  const handleAdd = () => {
    if (accounts.length >= MAX_ACCOUNTS) return;
    markAddingAccount();
    router.push('/login');
  };

  const handleRemove = (telegramId: string) => {
    const target = accounts.find((a) => a.telegramId === telegramId);
    const label = target ? `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() || target.telegramId : telegramId;
    if (!confirm(`Удалить аккаунт «${label}» из списка?`)) return;
    const { remaining, newActive } = removeAccount(telegramId);
    setAccounts(remaining);
    // Если удалили активный — нужно reload (cookie сменилась)
    if (target && active.telegramId === telegramId) {
      if (newActive) window.location.href = '/';
      else window.location.href = '/login';
    }
  };

  return (
    <div
      style={{
        background: '#060919',
        border: '1px solid #26252F',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Активный аккаунт */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-3"
        style={{ padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <Avatar account={active} />
        <div className="flex-1 min-w-0">
          <div
            className="font-overpass uppercase truncate"
            style={{ color: '#9B99AA', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}
          >
            Активный аккаунт
          </div>
          <div
            className="font-overpass truncate"
            style={{ color: '#F9F8FE', fontSize: 14, fontWeight: 800, marginTop: 2 }}
          >
            {displayName(active)}
          </div>
        </div>
        <span
          className="font-overpass"
          style={{ color: '#AEABBB', fontSize: 18, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ⌄
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #26252F' }}>
          {others.map((a) => (
            <div
              key={a.telegramId}
              className="flex items-center gap-3"
              style={{ padding: '10px 16px' }}
            >
              <button
                type="button"
                onClick={() => handleSwitch(a.telegramId)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <Avatar account={a} />
                <div className="flex-1 min-w-0">
                  <div
                    className="font-overpass truncate"
                    style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 700 }}
                  >
                    {displayName(a)}
                  </div>
                  {a.username && (
                    <div
                      className="font-overpass truncate"
                      style={{ color: '#AEABBB', fontSize: 11, marginTop: 2 }}
                    >
                      @{a.username}
                    </div>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleRemove(a.telegramId)}
                className="font-overpass uppercase"
                aria-label="Удалить аккаунт"
                style={{
                  background: 'transparent',
                  color: '#FF6B6B',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  padding: '6px 8px',
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {accounts.length < MAX_ACCOUNTS && (
            <button
              type="button"
              onClick={handleAdd}
              className="w-full font-overpass uppercase text-left"
              style={{
                padding: '14px 16px',
                background: 'transparent',
                color: '#A1FF4A',
                border: 'none',
                borderTop: others.length > 0 ? '1px solid #26252F' : 'none',
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              + Добавить аккаунт
            </button>
          )}
          {accounts.length >= MAX_ACCOUNTS && (
            <div
              className="font-overpass text-center"
              style={{
                padding: '10px 16px',
                color: '#9B99AA',
                fontSize: 11,
                borderTop: '1px solid #26252F',
              }}
            >
              Достигнут лимит ({MAX_ACCOUNTS}) аккаунтов
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function displayName(a: AuthData): string {
  const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  if (name) return name;
  if (a.username) return `@${a.username}`;
  return a.telegramId;
}

function Avatar({ account }: { account: AuthData }) {
  const initials = `${account.firstName?.[0] ?? ''}${account.lastName?.[0] ?? ''}`.trim() || account.telegramId.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: '#1a1f3a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontFamily: 'Overpass',
        fontSize: 13,
        color: '#F9F8FE',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
