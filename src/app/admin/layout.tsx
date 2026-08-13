import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { hasAdminAccessRSC } from '@/lib/admin-session';

/**
 * Server-component layout для /admin/*.
 * Middleware уже редиректит анонимных пользователей на /admin/login (по
 * наличию cookie), а здесь — реальная валидация admin_token / user.isAdmin.
 * Если cookie протух или подделан — серверный redirect на /admin/login.
 *
 * Старая 'use client' версия использовала getTelegramId() и проверяла
 * /api/user/is-admin с telegramId в query — это уже не работает для email-
 * юзеров и было уязвимо к timing/race conditions.
 */

/**
 * Оболочка админки. Класс .admin-layout нужен только для снятия мобильных
 * ограничений ширины (globals.css), а фон переопределяем токеном страницы:
 * в .admin-layout зашит #101530 — это токен КАРТОЧЕК (--color-surface), фон
 * страниц по дизайн-системе — --color-night. Страницы поверх всё равно красят
 * себя сами через <AdminPage>, так что оболочка не должна спорить с ними.
 */
function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout" style={{ background: 'var(--color-night)' }}>
      {children}
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // pathname приходит из middleware.ts (header 'x-pathname').
  // /admin/login обходит проверку — иначе была бы петля редиректа.
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '';

  if (pathname.startsWith('/admin/login')) {
    return <AdminShell>{children}</AdminShell>;
  }

  const isAdmin = await hasAdminAccessRSC();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return <AdminShell>{children}</AdminShell>;
}
