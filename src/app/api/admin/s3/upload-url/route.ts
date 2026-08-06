import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getS3Config, presignPutUrl } from '@/lib/s3';

// POST /api/admin/s3/upload-url — только isAdmin (requireAdminAsync).
// Выдаёт presigned PUT для прямой загрузки файла из браузера админа в
// собственное S3-хранилище (мимо нашего сервера).
//   Body:  { fileName, contentType, kind?: 'video' | 'thumbnail' }
//   Ответ: { uploadUrl, videoUrl } — uploadUrl для XHR PUT (с тем же Content-Type!).
//   kind=video     → приватный объект, videoUrl вида s3://videos/<id>.<ext>
//                    (плеер получает presigned GET через гейтированные роуты).
//   kind=thumbnail → ПУБЛИЧНЫЙ объект (ACL public-read: превью видно всем в
//                    каталоге, подписанные ссылки с TTL там протухали бы в кэше);
//                    videoUrl — прямой https-URL, пишется в Video.thumbnail.
//                    XHR обязан слать заголовок x-amz-acl: public-read — он в подписи.

export const dynamic = 'force-dynamic';

// Расширение берём из имени файла и пропускаем только известные форматы,
// чтобы в бакет не попадали произвольные ключи.
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

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
    const kind = body?.kind === 'thumbnail' ? 'thumbnail' : body?.kind === 'short' ? 'short' : 'video';

    const expectedPrefix = kind === 'thumbnail' ? 'image/' : 'video/';
    if (!contentType.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: kind === 'thumbnail' ? 'Превью — только изображение (image/*)' : 'Можно загружать только видеофайлы (video/*)' },
        { status: 400 },
      );
    }

    const allowed = kind === 'thumbnail' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (!allowed.has(ext)) {
      return NextResponse.json(
        { error: `Недопустимое расширение файла. Разрешены: ${[...allowed].join(', ')}` },
        { status: 400 },
      );
    }

    // Ключ — случайный id (UUID), не имя файла: без коллизий и без утечки названий.
    const config = getS3Config()!;
    // Публичные объекты (прямой https-URL без TTL): превью — видны всем в
    // каталоге; шортсы — бесплатный контент по продукту (paywall их не гейтит),
    // а presigned-ссылки протухали бы в ленте.
    if (kind === 'thumbnail' || kind === 'short') {
      const prefix = kind === 'thumbnail' ? 'thumbnails' : 'shorts';
      const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
      const uploadUrl = await presignPutUrl(key, contentType, undefined, { acl: 'public-read' });
      const publicUrl = `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${key}`;
      return NextResponse.json({ uploadUrl, videoUrl: publicUrl, acl: 'public-read' });
    }

    const key = `videos/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await presignPutUrl(key, contentType);

    return NextResponse.json({ uploadUrl, videoUrl: `s3://${key}` });
  } catch (error) {
    console.error('s3 upload-url POST failed', error);
    return NextResponse.json({ error: 'Не удалось подготовить загрузку в хранилище' }, { status: 500 });
  }
}
