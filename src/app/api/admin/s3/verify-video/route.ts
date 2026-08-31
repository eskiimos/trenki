import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getS3Config, s3KeyFromUrl, s3KeyFromPublicUrl, readObjectRange } from '@/lib/s3';

/**
 * POST /api/admin/s3/verify-video { videoUrl } — проверка только что залитого
 * видео на «готовность к вебу», насколько это возможно без транскодинга.
 *
 * Сейчас ловим главный тихий убийца ленты — отсутствие faststart: у файла из
 * камеры/монтажки moov-атом (метаданные) часто лежит В КОНЦЕ, и плеер не может
 * начать воспроизведение, пока не дотянется до хвоста файла. В ленте шортсов
 * это выглядит как «видео не грузится» (реальный случай 2026-08-31: шортс
 * 30 МБ / 13 Мбит/с, mdat перед moov).
 *
 * Файл НЕ скачивается целиком: читаем первые 64КБ прямо из бакета.
 * Ответ: { ok: true } | { ok: false, warning: '...' }
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    if (!getS3Config()) {
      return NextResponse.json({ error: 'S3 не настроено' }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    const url = String(body?.videoUrl || '');
    const key = s3KeyFromUrl(url) ?? s3KeyFromPublicUrl(url);
    if (!key) {
      return NextResponse.json({ error: 'Не наш S3-URL' }, { status: 400 });
    }

    const head = (await readObjectRange(key, 0, 65535)).toString('latin1');
    const moov = head.indexOf('moov');
    const mdat = head.indexOf('mdat');
    // ok: метаданные в начале файла (faststart). WebM ('ftyp' нет) пропускаем
    // как ок — у него другая структура, и он всегда стримится.
    const isMp4 = head.includes('ftyp');
    const ok = !isMp4 || (moov >= 0 && (mdat < 0 || moov < mdat));

    return NextResponse.json(
      ok
        ? { ok: true }
        : {
            ok: false,
            warning:
              'Файл без faststart: метаданные в конце — на телефонах видео будет «вечно грузиться». ' +
              'Перезалей с включённым faststart (ffmpeg -movflags +faststart или экспорт «для веба»).',
          },
    );
  } catch (error) {
    console.error('verify-video failed:', error);
    return NextResponse.json({ error: 'Не удалось проверить файл' }, { status: 500 });
  }
}
