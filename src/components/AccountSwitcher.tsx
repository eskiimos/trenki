'use client';

// Переключатель мульти-аккаунтов. Источник истины — сервер: список аккаунтов
// устройства живёт в подписанной httpOnly-cookie, компонент только читает его
// через GET /api/auth/accounts и дёргает switch/remove. Ни localStorage, ни
// telegramId, ни клиентских cookie здесь быть не должно — идентификатор
// аккаунта это его `id` из БД.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Trash2, UserPlus, X } from 'lucide-react';
import { MAX_ACCOUNTS } from '@/lib/account-list';

interface Props {
  /** Если задано — компонент скрывается, когда аккаунт всего один. */
  hideWhenSingle?: boolean;
}

type AccountRole = 'ATHLETE' | 'COACH' | 'PARENT';

interface DeviceAccount {
  id: string;
  name: string;
  email: string | null;
  role: AccountRole;
  isActive: boolean;
  /** false — переключиться нельзя (админ-аккаунт: только вход по коду). */
  canSwitch?: boolean;
}

interface AccountsResponse {
  activeId: string | null;
  accounts: DeviceAccount[];
}

export default function AccountSwitcher({ hideWhenSingle = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<DeviceAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** id аккаунта, по которому сейчас идёт запрос (switch/remove) — блокирует повторные клики. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /** id аккаунта, для которого показано инлайновое подтверждение удаления. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Загрузка/перезагрузка списка. Источник истины — сервер, локально список не
   *  «домысливаем»: после удаления сервер мог подчистить и другие записи. */
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/accounts', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`accounts ${res.status}`);
      const data = (await res.json()) as AccountsResponse;
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
      setActiveId(data?.activeId ?? null);
    } catch {
      // Не залогинен / сеть отвалилась — просто не показываем переключатель.
      setAccounts([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSwitch = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/auth/switch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        // Полный reload обязателен: сменилась httpOnly-cookie сессии.
        window.location.href = typeof data.redirect === 'string' ? data.redirect : '/';
        return;
      }
      setError(typeof data?.error === 'string' ? data.error : 'Не удалось переключить аккаунт');
    } catch {
      setError('Нет связи с сервером');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/auth/accounts/remove', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(typeof data?.error === 'string' ? data.error : 'Не удалось убрать аккаунт');
        return;
      }
      if (data.activeCleared) {
        // Сервер сбросил текущую сессию — уводим на логин.
        window.location.href = '/login';
        return;
      }
      setConfirmId(null);
      // Перечитываем с сервера, а не патчим локально: сервер мог заодно
      // подчистить исчезнувшие аккаунты, и стейт разъехался бы с cookie.
      await load();
    } catch {
      setError('Нет связи с сервером');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = () => {
    if (accounts.length >= MAX_ACCOUNTS) return;
    // Никаких маркеров в sessionStorage: сервер сам добавит аккаунт в список
    // устройства после успешного логина.
    router.push('/login');
  };

  // Пока идёт первый запрос — ничего не рендерим, чтобы блок не мигал и не
  // прыгала вёрстка (компонент может вообще не показаться: hideWhenSingle).
  if (loading) return null;
  if (accounts.length === 0) return null;
  if (hideWhenSingle && accounts.length <= 1) return null;

  // Активный определяем строго по ответу сервера. Раньше был фолбэк на
  // accounts[0] — он рисовал «текущим» чужой аккаунт, когда своей юзерской
  // сессии нет (например, в админку вошли по admin_token).
  const active = accounts.find((a) => a.id === activeId) ?? accounts.find((a) => a.isActive);
  if (!active) return null;
  const others = accounts.filter((a) => a.id !== active.id);
  const atLimit = accounts.length >= MAX_ACCOUNTS;

  return (
    <div
      style={{
        background: 'var(--color-night)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* ───────── Активный аккаунт / кнопка раскрытия ───────── */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setConfirmId(null);
          setError(null);
        }}
        aria-expanded={open}
        aria-controls="account-switcher-list"
        className="w-full text-left flex items-center gap-3"
        style={{
          padding: 12,
          minHeight: 44,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Avatar name={active.name} email={active.email} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <Check size={16} strokeWidth={2.5} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
            <span
              className="font-overpass truncate"
              style={{ color: 'var(--color-ink)', fontSize: 14, fontWeight: 800 }}
            >
              {displayName(active)}
            </span>
          </div>
          {active.email && (
            <div
              className="font-overpass truncate"
              style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 2 }}
            >
              {active.email}
            </div>
          )}
        </div>
        <ChevronDown
          size={20}
          style={{
            color: 'var(--color-muted)',
            flexShrink: 0,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div id="account-switcher-list" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          {others.map((a) =>
            confirmId === a.id ? (
              /* ───────── Инлайновое подтверждение удаления ───────── */
              <div
                key={a.id}
                className="flex items-center gap-2"
                style={{ padding: '8px 12px', minHeight: 44 }}
              >
                <span
                  className="font-overpass flex-1 min-w-0 truncate"
                  style={{ color: 'var(--color-ink)', fontSize: 12, fontWeight: 700 }}
                >
                  Удалить?
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  disabled={busyId === a.id}
                  className="font-overpass uppercase"
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    background: 'transparent',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-pill)',
                    color: 'var(--color-danger)',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    cursor: busyId === a.id ? 'default' : 'pointer',
                    opacity: busyId === a.id ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  Да
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  aria-label="Отменить удаление"
                  className="flex items-center justify-center"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              /* ───────── Обычная строка аккаунта ───────── */
              <div key={a.id} className="flex items-center gap-2" style={{ padding: '8px 12px' }}>
                <button
                  type="button"
                  onClick={() => handleSwitch(a.id)}
                  /* В админ-аккаунт переключиться нельзя — только вход по коду.
                     Сервер отдаёт canSwitch=false, показываем это заранее, а не
                     ошибкой после тапа. */
                  disabled={busyId !== null || a.canSwitch === false}
                  title={a.canSwitch === false ? 'В этот аккаунт нужно войти по коду' : undefined}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  style={{
                    minHeight: 44,
                    background: 'transparent',
                    border: 'none',
                    cursor: busyId !== null || a.canSwitch === false ? 'default' : 'pointer',
                    opacity:
                      a.canSwitch === false ? 0.5 : busyId !== null && busyId !== a.id ? 0.6 : 1,
                  }}
                >
                  <Avatar name={a.name} email={a.email} />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-overpass truncate"
                      style={{ color: 'var(--color-ink)', fontSize: 13, fontWeight: 700 }}
                    >
                      {displayName(a)}
                    </div>
                    {a.canSwitch === false ? (
                      <div
                        className="font-overpass truncate"
                        style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 2 }}
                      >
                        вход по коду
                      </div>
                    ) : a.email && (
                      <div
                        className="font-overpass truncate"
                        style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 2 }}
                      >
                        {a.email}
                      </div>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmId(a.id);
                    setError(null);
                  }}
                  aria-label={`Убрать аккаунт ${displayName(a)} из списка`}
                  className="flex items-center justify-center"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )
          )}

          {!atLimit && (
            <button
              type="button"
              onClick={handleAdd}
              className="w-full font-overpass uppercase text-left flex items-center gap-3"
              style={{
                padding: 12,
                minHeight: 44,
                background: 'transparent',
                color: 'var(--color-brand)',
                border: 'none',
                borderTop: others.length > 0 ? '1px solid var(--border-hairline)' : 'none',
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              <UserPlus size={20} style={{ flexShrink: 0 }} />
              <span className="truncate">Добавить аккаунт</span>
            </button>
          )}

          {atLimit && (
            <div
              className="font-overpass text-center"
              style={{
                padding: '8px 12px',
                color: 'var(--color-muted)',
                fontSize: 11,
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              Достигнут лимит ({MAX_ACCOUNTS}) аккаунтов
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="font-overpass"
              style={{
                padding: '8px 12px',
                color: 'var(--color-danger)',
                fontSize: 11,
                fontWeight: 700,
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function displayName(a: DeviceAccount): string {
  const name = a.name?.trim();
  if (name) return name;
  if (a.email) return a.email;
  return 'Аккаунт';
}

function initialsOf(name: string, email: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  if (letters) return letters.toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function Avatar({ name, email }: { name: string; email: string | null }) {
  return (
    <div
      aria-hidden
      className="font-overpass"
      style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-surface)',
        border: '1px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 13,
        color: 'var(--color-ink)',
        flexShrink: 0,
      }}
    >
      {initialsOf(name, email)}
    </div>
  );
}
