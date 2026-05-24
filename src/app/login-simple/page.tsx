import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Старая страница Telegram-логина выключена. Редиректим на email-логин.
export default function LoginSimple() {
  redirect('/login');
}
