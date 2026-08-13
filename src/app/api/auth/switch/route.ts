import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  signSession,
  setSessionCookie,
  getSessionFromRequest,
  sessionSecondsLeft,
} from '@/lib/session';
import {
  getAccountsFromRequest,
  writeAccounts,
  removeAccount,
  findAccount,
  redirectForRole,
  ADMIN_TTL_SECONDS,
  ACCOUNT_TTL_SECONDS,
  ttlFor,
  hasAdminEntry,
  clearAccountsCookie,
} from '@/lib/account-list';
import { isSameOrigin } from '@/lib/same-origin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/switch  { userId }
 *
 * Переключение на другой аккаунт устройства без повторного ввода кода.
 *
 * Слои защиты:
 *  1. Нужна ДЕЙСТВУЮЩАЯ сессия (иначе долгоживущая accounts-cookie работала бы
 *     как вечный refresh-токен).
 *  2. Нужен same-origin Origin: SameSite=Lax не режет наш же поддомен.
 *  3. userId обязан быть в ПОДПИСАННОМ списке устройства (сырой id из тела сам
 *     по себе не даёт ничего).
 *  4. Новая сессия наследует ДЕДЛАЙН записи (`lgn` — момент реального входа по
 *     коду): переключение не продлевает доступ, цепочка A→B→A не бесконечна.
 *  5. Устройство должно быть админским (мульти-аккаунт — фича админов): сам
 *     админ либо аккаунт, добавленный админом со своего устройства.
 *  6. У админ-аккаунта срок короткий (ADMIN_TTL_SECONDS): «забытая» на общем
 *     устройстве возможность войти в админку протухает за часы, а не за месяц.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.uid) {
    return NextResponse.json({ error: 'Нужна авторизация' }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Запрос отклонён' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  const raw = (body as { userId?: unknown })?.userId;
  // Форму id проверяем до логирования, чтобы в логи не улетала строка атакующего.
  const userId = typeof raw === 'string' && /^[a-z0-9]{20,40}$/i.test(raw) ? raw : null;
  if (!userId) {
    return NextResponse.json({ error: 'userId обязателен' }, { status: 400 });
  }
  if (userId === session.uid) {
    // Переключение «в себя» ничего не меняет, но перевыпускало бы сессию —
    // то есть служило бы оракулом бесконечного продления.
    return NextResponse.json({ error: 'Этот аккаунт уже активен' }, { status: 400 });
  }

  const accounts = await getAccountsFromRequest(request);

  // Сужение до админов enforced НА СЕРВЕРЕ, а не только скрытием UI: устройство
  // должно быть админским — либо ты сам админ, либо в списке есть админ-запись
  // (значит админ добавил этот аккаунт со своего устройства). Иначе — 403 и
  // зачистка legacy-списка, накопленного до сужения фичи.
  const me = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { isAdmin: true },
  });
  const deviceEnabled = me?.isAdmin === true || hasAdminEntry(accounts);
  if (!deviceEnabled) {
    const response = NextResponse.json({ error: 'Недоступно' }, { status: 403 });
    if (accounts.length > 0) clearAccountsCookie(response);
    return response;
  }

  const target = findAccount(accounts, userId);
  if (!target) {
    // Сюда же попадают записи с истёкшим дедлайном: getAccountsFromRequest их
    // уже отбросил. Текст покрывает оба случая — через месяц после релиза
    // «срок истёк» будет самым частым сценарием, и «не авторизован» врало бы.
    // Существует ли такой пользователь вообще — не раскрываем.
    logger.warn('account switch denied: not in device list', { from: session.uid });
    return NextResponse.json(
      { error: 'Аккаунт недоступен на этом устройстве — войди в него по коду' },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isAdmin: true },
  });

  if (!user) {
    // Пользователя удалили — вычищаем из списка устройства.
    const response = NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 });
    await writeAccounts(response, removeAccount(accounts, userId));
    return response;
  }

  // Срок — СТРОГИЙ из двух: по флагу записи и по фактическому статусу из БД.
  // Так закрыты оба направления: аккаунт стал админским после записи (иначе
  // унаследовал бы 30 дней) и аккаунт разжалован (иначе 12-часовая запись
  // выпустила бы 30-дневную сессию).
  const ttl = Math.min(ttlFor(target), user.isAdmin ? ADMIN_TTL_SECONDS : ACCOUNT_TTL_SECONDS);
  const secondsLeft = sessionSecondsLeft(target.lgn, new Date(), ttl);
  if (secondsLeft <= 0) {
    // Для админ-записи это норма уже через 12 часов — просим войти по коду.
    logger.info('account switch expired', { from: session.uid, admin: user.isAdmin });
    const response = NextResponse.json(
      { error: 'Срок входа истёк — войди в этот аккаунт по коду' },
      { status: 403 },
    );
    await writeAccounts(response, removeAccount(accounts, userId));
    return response;
  }

  const role = user.role === 'COACH' ? 'COACH' : user.role === 'PARENT' ? 'PARENT' : 'ATHLETE';
  // lgn НЕ обновляем — дедлайн наследуется от реального входа по коду.
  const token = await signSession({ uid: user.id, role, lgn: target.lgn }, ttl);

  const response = NextResponse.json({
    success: true,
    role,
    redirect: redirectForRole(role),
  });
  setSessionCookie(response, token, secondsLeft);
  // Cookie со списком НЕ переписываем: содержимое не изменилось, а лишняя
  // переподпись только сдвигала бы срок жизни самой cookie.

  logger.info('account switched', { from: session.uid, to: user.id, role });
  return response;
}
