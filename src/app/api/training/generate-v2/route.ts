import { NextResponse } from 'next/server';

/**
 * POST /api/training/generate-v2
 *
 * DEPRECATED / удалён. Используйте /api/training/generate-v3.
 * Клиентом не вызывался, но был живым authenticated-роутом, создававшим
 * standalone WorkoutSession БЕЗ подписочной квоты — в обход лимита «1 бесплатная
 * ИИ-тренировка в неделю» из generate-v3. Закрыт (410), чтобы не был дырой в
 * paywall при включённом режиме.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Этот endpoint удалён. Используйте POST /api/training/generate-v3.' },
    { status: 410 },
  );
}
