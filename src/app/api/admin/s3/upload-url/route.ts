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
//
// mov/m4v УБРАНЫ (2026-08-31): у нас нет транскодинга — что залито, то и
// раздаётся плеерам. Исходник .mov с камеры (реальный случай: 2.7K H.264
// High@5.0, 12 Мбит/с, 804 МБ за 9 минут) мобильные не тянут — «видео не
// грузится». Kinescope пережимал за нас; свой S3 — нет. Принимаем только
// готовые к вебу mp4/webm, требования — в подсказке формы.
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

// Максимальный размер видеофайла: при ~5 Мбит/с это ~25 минут — с запасом
// больше любого модуля. Файл крупнее почти наверняка сырой исходник.
// (Не export: route-файлы App Router не терпят посторонних экспортов.)
const MAX_VIDEO_BYTES = 800 * 1024 * 1024;

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
      const hint =
        kind === 'thumbnail'
          ? ''
          : ext === 'mov' || ext === 'm4v'
            ? ' Исходники с камеры (.mov) мобильные не проигрывают — экспортируй как MP4 (H.264, 1080p).'
            : '';
      return NextResponse.json(
        { error: `Недопустимое расширение файла. Разрешены: ${[...allowed].join(', ')}.${hint}` },
        { status: 400 },
      );
    }

    // Размер (клиент присылает file.size; лгать может, но это админ-гигиена,
    // а не безопасность): гигантский файл — признак сырого исходника.
    const fileSize = Number(body?.fileSize);
    if (kind !== 'thumbnail' && Number.isFinite(fileSize) && fileSize > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        {
          error: `Файл ${Math.round(fileSize / 1024 / 1024)} МБ — слишком большой. Пережми в MP4 (H.264 1080p, ~4-5 Мбит/с): модуль на 10 минут — это ~300-400 МБ.`,
        },
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
