import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getS3Config, presignPutUrl } from '@/lib/s3';

// POST /api/admin/s3/upload-url — только isAdmin (requireAdminAsync).
// Выдаёт presigned PUT для прямой загрузки видеофайла из браузера админа в
// собственное S3-хранилище (мимо нашего сервера).
//   Body:  { fileName, contentType }
//   Ответ: { uploadUrl, videoUrl } — uploadUrl для XHR PUT (с тем же Content-Type!),
//          videoUrl вида s3://videos/<id>.<ext> — его пишем в Video.videoUrl.

export const dynamic = 'force-dynamic';

// Расширение берём из имени файла и пропускаем только известные видео-контейнеры,
// чтобы в бакет не попадали произвольные ключи.
const ALLOWED_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v']);

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    if (!getS3Config()) {
      return NextResponse.json(
        { error: 'S3-хранилище не настроено: заполните S3_* переменные окружения' },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const fileName = String(body?.fileName || '').trim();
    const contentType = String(body?.contentType || '').trim();

    if (!contentType.startsWith('video/')) {
      return NextResponse.json({ error: 'Можно загружать только видеофайлы (video/*)' }, { status: 400 });
    }

    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Недопустимое расширение файла. Разрешены: ${[...ALLOWED_EXTENSIONS].join(', ')}` },
        { status: 400 },
      );
    }

    // Ключ — случайный id (UUID), не имя файла: без коллизий и без утечки названий.
    const key = `videos/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await presignPutUrl(key, contentType);

    return NextResponse.json({ uploadUrl, videoUrl: `s3://${key}` });
  } catch (error) {
    console.error('s3 upload-url POST failed', error);
    return NextResponse.json({ error: 'Не удалось подготовить загрузку в хранилище' }, { status: 500 });
  }
}
