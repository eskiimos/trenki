/**
 * Хранилище записанных pose-сессий (скелет атлета).
 *
 * Раньше: `PoseSession.frames` — JSONB-колонка с массивом до 9000 кадров (~5–10 МБ
 * на сессию). При нескольких тысячах сессий — десятки ГБ в Postgres.
 *
 * Сейчас: сериализуем массив кадров в JSON, gzip-сжимаем и заливаем в Cloudinary
 * как private raw-ассет. В БД храним только `framesUrl` и `framesEncoding`.
 *
 * Безопасность:
 *  - Тип ассета `authenticated`: публичный URL без подписи возвращает 401.
 *  - На GET /api/pose-sessions/[id] бэкенд проверяет роль (coach или владелец)
 *    и подписывает временный URL (TTL 1 час) через `cloudinary.utils.private_download_url`.
 */

import { v2 as cloudinary } from 'cloudinary';
import { gzipSync, gunzipSync } from 'zlib';

const CLOUDINARY_FOLDER = 'trenki/pose-sessions';
export const POSE_FRAMES_ENCODING = 'json-gzip';
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 час

function ensureConfigured(): void {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary не настроен (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export function isPoseStorageConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export interface PoseFramesDocument {
  fps: number | null;
  frames: number[][];
}

/**
 * Сериализует кадры (JSON → gzip → Buffer). Возвращает payload и его размер
 * (для метрик/лимитов).
 */
export function encodePoseFrames(doc: PoseFramesDocument): Buffer {
  const json = Buffer.from(JSON.stringify(doc), 'utf8');
  return gzipSync(json, { level: 9 });
}

export function decodePoseFrames(buf: Buffer): PoseFramesDocument {
  const json = gunzipSync(buf).toString('utf8');
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('pose frames: invalid payload');
  }
  return {
    fps: typeof parsed.fps === 'number' ? parsed.fps : null,
    frames: Array.isArray(parsed.frames) ? parsed.frames : [],
  };
}

/**
 * Складываем gzip-payload в Cloudinary. Возвращаем public_id, по которому
 * потом подпишем URL.
 */
export async function uploadPoseFrames(
  sessionId: string,
  payload: Buffer,
): Promise<string> {
  ensureConfigured();
  const publicId = `${CLOUDINARY_FOLDER}/${sessionId}`;
  await new Promise<void>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated', // публичный URL без подписи — 401
          public_id: publicId,
          overwrite: true,
          // gzip-payload — храним как есть.
          format: 'json.gz',
        },
        (err) => (err ? reject(err) : resolve()),
      )
      .end(payload);
  });
  return publicId;
}

/**
 * Возвращает signed-URL на чтение pose-кадров. Только владелец/тренер должны
 * получать этот URL — проверка делается выше по стеку.
 */
export function signPoseFramesUrl(publicId: string): string {
  ensureConfigured();
  return cloudinary.utils.private_download_url(publicId, 'json.gz', {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SEC,
  });
}

/**
 * Скачивает gzip-payload (для бэкфилла и серверного fallback'а).
 */
export async function downloadPoseFrames(publicId: string): Promise<Buffer> {
  ensureConfigured();
  const url = signPoseFramesUrl(publicId);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Cloudinary download failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Удалить ассет (для скрипта бэкфилла, если что-то пошло не так).
 */
export async function deletePoseFrames(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
  });
}
