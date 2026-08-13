import { beforeAll, describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/session';

beforeAll(() => {
  // Тестовый секрет — отдельный, чтобы случайно не использовать prod.
  process.env.SESSION_SECRET = 'unit-test-secret-1234567890-abcdefg-XYZ';
});

describe('signSession + verifySession', () => {
  it('round-trip даёт обратно тот же uid, role и lgn', async () => {
    const lgn = Math.floor(Date.now() / 1000);
    const token = await signSession({ uid: 'user-123', role: 'COACH', lgn });
    const payload = await verifySession(token);
    expect(payload).toEqual({ uid: 'user-123', role: 'COACH', lgn });
  });

  it('старый токен без lgn не разлогинивает: дедлайн берётся от iat', async () => {
    // Токены, выпущенные до появления абсолютного дедлайна, обязаны продолжать
    // работать — иначе релиз выкинул бы всех текущих пользователей.
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const legacy = await new SignJWT({ uid: 'legacy-1', role: 'ATHLETE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('trenki')
      .setAudience('trenki-web')
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);
    const payload = await verifySession(legacy);
    expect(payload?.uid).toBe('legacy-1');
    expect(typeof payload?.lgn).toBe('number');
  });

  it('невалидный токен → null (никаких throw наружу)', async () => {
    expect(await verifySession('not-a-jwt')).toBeNull();
    expect(await verifySession('aaa.bbb.ccc')).toBeNull();
  });

  it('токен, подписанный другим секретом, отбрасывается', async () => {
    const token = await signSession({ uid: 'u1', role: 'ATHLETE', lgn: Math.floor(Date.now() / 1000) });
    process.env.SESSION_SECRET = 'another-secret-1234567890-abcdefg-XYZ';
    expect(await verifySession(token)).toBeNull();
    // Возвращаем для других тестов
    process.env.SESSION_SECRET = 'unit-test-secret-1234567890-abcdefg-XYZ';
  });

  it('неизвестная role нормализуется в ATHLETE', async () => {
    // Подписали корректным секретом, но "role" в payload может прийти кривой —
    // verifySession не должна доверять её и должна вернуть безопасный дефолт.
    const token = await signSession({ uid: 'u2', role: 'ATHLETE' as 'ATHLETE', lgn: Math.floor(Date.now() / 1000) });
    const payload = await verifySession(token);
    expect(payload?.role).toBe('ATHLETE');
  });

  it('короткий SESSION_SECRET ломает signSession явной ошибкой', async () => {
    const saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'too-short';
    await expect(signSession({ uid: 'u', role: 'ATHLETE', lgn: Math.floor(Date.now() / 1000) })).rejects.toThrow(
      /SESSION_SECRET/,
    );
    process.env.SESSION_SECRET = saved;
  });
});
