import { describe, it, expect, beforeAll } from 'vitest';
import {
  addAccount,
  removeAccount,
  pruneExpired,
  sameList,
  findAccount,
  signAccounts,
  verifyAccounts,
  MAX_ACCOUNTS,
  ACCOUNT_TTL_SECONDS,
  ADMIN_TTL_SECONDS,
  ttlFor,
  isAccountAlive,
  hasAdminEntry,
  type DeviceAccount,
} from '@/lib/account-list';
import { signSession, sessionSecondsLeft } from '@/lib/session';

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || 'test-secret-at-least-32-characters-long-000000';
});

const nowSec = () => Math.floor(Date.now() / 1000);
const acc = (id: string, agoSec = 0): DeviceAccount => ({ id, lgn: nowSec() - agoSec });

describe('операции над списком устройства', () => {
  it('добавляет в начало (последний вошедший — первый)', () => {
    const list = addAccount([acc('a'), acc('b')], 'c', nowSec());
    expect(list.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('дубли схлопываются — повторный вход поднимает наверх и обновляет lgn', () => {
    const old = [{ id: 'c', lgn: nowSec() - 1000 }, acc('a')];
    const fresh = nowSec();
    const list = addAccount(old, 'c', fresh);
    expect(list.map((x) => x.id)).toEqual(['c', 'a']);
    expect(list[0].lgn).toBe(fresh);
  });

  it('обрезает по лимиту MAX_ACCOUNTS', () => {
    const many = Array.from({ length: MAX_ACCOUNTS + 3 }, (_, i) => acc(`u${i}`));
    const list = addAccount(many, 'new', nowSec());
    expect(list).toHaveLength(MAX_ACCOUNTS);
    expect(list[0].id).toBe('new');
  });

  it('удаление убирает только нужный id', () => {
    expect(removeAccount([acc('a'), acc('b')], 'a').map((x) => x.id)).toEqual(['b']);
    expect(removeAccount([acc('a')], 'нет-такого').map((x) => x.id)).toEqual(['a']);
  });

  it('sameList различает изменения (нужен, чтобы не переподписывать cookie зря)', () => {
    const a = [acc('x')];
    expect(sameList(a, [...a])).toBe(true);
    expect(sameList(a, [acc('y')])).toBe(false);
    expect(sameList(a, [])).toBe(false);
  });

  it('findAccount возвращает запись с её lgn', () => {
    const list = [acc('a', 100)];
    expect(findAccount(list, 'a')?.lgn).toBe(list[0].lgn);
    expect(findAccount(list, 'b')).toBeNull();
  });
});

describe('АБСОЛЮТНЫЙ ДЕДЛАЙН: запись живёт от реального входа по коду', () => {
  it('протухшая запись отбрасывается', () => {
    const expired = { id: 'old', lgn: nowSec() - ACCOUNT_TTL_SECONDS - 10 };
    expect(pruneExpired([expired, acc('fresh')]).map((x) => x.id)).toEqual(['fresh']);
  });

  it('переподпись cookie НЕ продлевает доступ по записи', async () => {
    // Ключевое свойство: злоумышленник не может крутить cookie, чтобы жить вечно.
    const almostExpired = { id: 'u', lgn: nowSec() - ACCOUNT_TTL_SECONDS + 60 };
    const token = await signAccounts([almostExpired]);
    const back = await verifyAccounts(token);
    expect(back[0].lgn).toBe(almostExpired.lgn); // lgn не сдвинулся
    expect(sessionSecondsLeft(back[0].lgn)).toBeLessThanOrEqual(60);
  });

  it('запись с истёкшим дедлайном не переживает подпись/проверку', async () => {
    const token = await signAccounts([{ id: 'u', lgn: nowSec() - ACCOUNT_TTL_SECONDS - 1 }]);
    expect(await verifyAccounts(token)).toEqual([]);
  });

  it('lgn ИЗ БУДУЩЕГО отвергается (иначе запись жила бы дольше TTL)', async () => {
    // На этом инварианте держится весь абсолютный дедлайн: если бы `lgn` можно
    // было увести вперёд, доступ снова стал бы бесконечным.
    const token = await signAccounts([{ id: 'u', lgn: nowSec() + 60 * 60 * 24 * 365 }]);
    expect(await verifyAccounts(token)).toEqual([]);
  });

  it('небольшое расхождение часов допускается', async () => {
    const token = await signAccounts([{ id: 'u', lgn: nowSec() + 60 }]);
    expect((await verifyAccounts(token)).map((x) => x.id)).toEqual(['u']);
  });
});

describe('АДМИН-ЗАПИСЬ: короткий срок (фича только для админов)', () => {
  it('у админ-записи TTL короче обычной', () => {
    expect(ttlFor({ adm: true })).toBe(ADMIN_TTL_SECONDS);
    expect(ttlFor({})).toBe(ACCOUNT_TTL_SECONDS);
    expect(ADMIN_TTL_SECONDS).toBeLessThan(ACCOUNT_TTL_SECONDS);
  });

  it('админ-запись протухает через свой короткий срок, обычная — жива', () => {
    const old = nowSec() - ADMIN_TTL_SECONDS - 60;
    expect(isAccountAlive({ id: 'a', lgn: old, adm: true })).toBe(false);
    expect(isAccountAlive({ id: 'b', lgn: old })).toBe(true);
  });

  it('флаг adm переживает подпись/проверку (иначе срок стал бы 30 дней)', async () => {
    const token = await signAccounts([{ id: 'a', lgn: nowSec(), adm: true }]);
    const back = await verifyAccounts(token);
    expect(back[0].adm).toBe(true);
  });

  it('протухшая админ-запись не переживает проверку', async () => {
    const token = await signAccounts([
      { id: 'a', lgn: nowSec() - ADMIN_TTL_SECONDS - 60, adm: true },
    ]);
    expect(await verifyAccounts(token)).toEqual([]);
  });

  it('addAccount проставляет adm, hasAdminEntry его видит', () => {
    const list = addAccount([], 'a', nowSec(), true);
    expect(list[0].adm).toBe(true);
    expect(hasAdminEntry(list)).toBe(true);
    expect(hasAdminEntry(addAccount([], 'b', nowSec()))).toBe(false);
  });

  it('sameList замечает смену adm (иначе cookie не переписалась бы)', () => {
    const t = nowSec();
    expect(sameList([{ id: 'a', lgn: t }], [{ id: 'a', lgn: t, adm: true }])).toBe(false);
  });
});

describe('signAccounts / verifyAccounts', () => {
  it('подписанный список читается обратно', async () => {
    const list = [acc('u1'), acc('u2')];
    const token = await signAccounts(list);
    expect((await verifyAccounts(token)).map((x) => x.id)).toEqual(['u1', 'u2']);
  });

  it('подделанный токен отвергается', async () => {
    const token = await signAccounts([acc('u1')]);
    expect(await verifyAccounts(token.slice(0, -3) + 'aaa')).toEqual([]);
  });

  it('мусор вместо токена — пустой список, без исключения', async () => {
    expect(await verifyAccounts('не-jwt')).toEqual([]);
    expect(await verifyAccounts('')).toEqual([]);
  });

  it('ИЗОЛЯЦИЯ AUDIENCE: session-токен не принимается как список аккаунтов', async () => {
    // Иначе валидная сессия сошла бы за «список устройства» и открыла
    // переключение в произвольный аккаунт.
    const sessionToken = await signSession({ uid: 'u1', role: 'ATHLETE', lgn: nowSec() });
    expect(await verifyAccounts(sessionToken)).toEqual([]);
  });

  it('записи без lgn (или битые) отбрасываются', async () => {
    const token = await signAccounts([
      acc('ok'),
      { id: 'bad' } as unknown as DeviceAccount,
    ]);
    expect((await verifyAccounts(token)).map((x) => x.id)).toEqual(['ok']);
  });
});
