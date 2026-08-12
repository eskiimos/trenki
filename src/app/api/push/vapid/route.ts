import { NextResponse } from 'next/server';

// GET — публичный VAPID-ключ. Только публичная часть, безопасно отдавать наружу.
// Используется service worker'ом (`public/sw.js`) при событии pushsubscriptionchange:
// в SW нет доступа к сборочным env-переменным Next, поэтому ключ он берёт отсюда.
export async function GET() {
  return NextResponse.json({ key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '' });
}
