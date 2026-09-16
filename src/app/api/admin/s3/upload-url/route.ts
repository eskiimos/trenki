import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';
import { getS3Config, presignPutUrl } from '@/lib/s3';

// POST /api/admin/s3/upload-url — только isAdmin (requireAdminAsync).
// Выдаёт presigned PUT для прямой загрузки файла из браузера админа в
// собственное S3-хранилище (мимо нашего сервера).
//   Body:  { fileName, contentType, kind?: 'video' | 'short' | 'thumbnail', fileSize? }
//   Ответ: { uploadUrl, videoUrl, acl? } — uploadUrl для XHR PUT.
//   kind=video|short → сырой исходник, приватный: s3://uploads/<uuid>.<ext>.
//                      Играть его нельзя — после сохранения карточки сервер
//                      пережимает файл (src/lib/media/worker.ts) и сам подменяет
//                      videoUrl на готовый mp4.
//   kind=thumbnail   → ПУБЛИЧНЫЙ объект (ACL public-read: превью видно всем в
//                      каталоге, подписанные ссылки с TTL там протухали бы в кэше);
//                      videoUrl — прямой https-URL, пишется в thumbnail.
//                      XHR шлёт заголовок x-amz-acl: public-read.

export const dynamic = 'force-dynamic';

// С транскодингом на сервере принимаем то, что реально отдаёт телефон/камера:
// iPhone из «Фото» — .MOV, монтажки — .mp4/.m4v. Расширение нужно только для
// ключа объекта (ffmpeg определяет формат по содержимому).
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

// Реальные исходники модулей — 1,3–1,8 ГБ (2.7K, 19 мин). Потолок — с запасом,
// но ниже лимита одиночного PUT в S3 (5 ГиБ). Проверяется по fileSize от клиента
// (админ-гигиена, не безопасность).
// (Не export: route-файлы App Router не терпят посторонних экспортов.)
const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

// Заливка 1,8 ГБ с телефона легко идёт дольше часа; подпись с запасом.
const VIDEO_PUT_TTL_SEC = 6 * 3600;

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
        { error: kind === 'thumbnail' ? 'Превью — только изображение (image/*)' : 'Можно загружать только видеофайлы' },
        { status: 400 },
      );
    }

    const allowed = kind === 'thumbnail' ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    if (!allowed.has(ext)) {
      return NextResponse.json(
        { error: `Недопустимый формат файла. Разрешены: ${[...allowed].join(', ')}.` },
        { status: 400 },
      );
    }

    const fileSize = Number(body?.fileSize);
    if (kind !== 'thumbnail' && Number.isFinite(fileSize) && fileSize > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: `Файл ${(fileSize / 1024 / 1024 / 1024).toFixed(1)} ГБ — слишком большой (максимум 4 ГБ).` },
        { status: 400 },
      );
    }

    // Ключ — случайный id (UUID), не имя файла: без коллизий и без утечки названий.
    const config = getS3Config()!;
    if (kind === 'thumbnail') {
      const key = `thumbnails/${crypto.randomUUID()}.${ext}`;
      const uploadUrl = await presignPutUrl(key, contentType, undefined, { acl: 'public-read' });
      const publicUrl = `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${key}`;
      return NextResponse.json({ uploadUrl, videoUrl: publicUrl, acl: 'public-read' });
    }

    const key = `uploads/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await presignPutUrl(key, contentType, VIDEO_PUT_TTL_SEC);
    return NextResponse.json({ uploadUrl, videoUrl: `s3://${key}` });
  } catch (error) {
    console.error('s3 upload-url POST failed', error);
    return NextResponse.json({ error: 'Не удалось подготовить загрузку в хранилище' }, { status: 500 });
  }
}
