import { NextResponse } from 'next/server';
import { getSubscriptionPricing } from '@/lib/settings';

// Публичные цены подписки (для окна оформления/модалки). Auth не нужен — цены публичны.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pricing = await getSubscriptionPricing();
    return NextResponse.json(pricing);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
