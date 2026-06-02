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
    return <div className="admin-layout">{children}</div>;
  }

  const isAdmin = await hasAdminAccessRSC();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  return <div className="admin-layout">{children}</div>;
}
