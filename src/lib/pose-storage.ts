/**
 * Хранилище pose-данных: записанные сессии атлетов (скелет с камеры) и эталоны
 * движений тренеров.
 *
 * Кадры сериализуем в JSON, gzip-сжимаем и кладём в НАШ S3 (reg.ru) закрытым
 * объектом: pose/sessions/<id>.json.gz, pose/references/<videoId>.json.gz. В БД
 * — только ссылка `s3://pose/...` и сводка. Наружу объект не отдаётся: клиент
 * получает кадры через наш API после проверки доступа (src/lib/pose-access.ts).
 *
 * История: до 22.09 кадры лежали в Cloudinary (raw, authenticated), а ещё
 * раньше — в JSONB-колонке PoseSession.frames. Старые записи переносит
 * /api/cron/pose-storage-migrate; до переноса они читаются отсюда же
 * (loadPoseFrames понимает и старые Cloudinary-id).
 */

import { v2 as cloudinary } from 'cloudinary';
import { gzipSync, gunzipSync } from 'zlib';
import { deleteS3ObjectStrict, getObjectBuffer, getS3Config, isS3Url, putObjectBuffer, s3KeyFromUrl } from '@/lib/s3';

export const POSE_FRAMES_ENCODING = 'json-gzip';
const RAW_FORMAT = 'json.gz';

export type PoseFramesKind = 'sessions' | 'references';

/** S3 настроен — pose-данные можно сохранять. */
export function isPoseStorageConfigured(): boolean {
  return getS3Config() !== null;
}

export interface PoseFramesDocument {
  fps: number | null;
  frames: number[][];
}

/** Кадры сессии → gzip JSON. */
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

/** Ключ объекта в S3 для записи сессии или эталона. */
export function poseFramesKey(kind: PoseFramesKind, id: string): string {
  return `pose/${kind}/${id.replace(/[^a-zA-Z0-9_-]/g, '')}.${RAW_FORMAT}`;
}

/** Сохранить gzip-кадры в S3; возвращает ссылку для БД (`s3://pose/...`). */
export async function savePoseFrames(kind: PoseFramesKind, id: string, gzip: Buffer): Promise<string> {
  const key = poseFramesKey(kind, id);
  await putObjectBuffer(key, gzip, 'application/gzip');
  return `s3://${key}`;
}

/** Прочитать gzip-кадры по ссылке из БД: S3 или (до переноса) старый Cloudinary-id. */
export async function loadPoseFrames(framesUrl: string): Promise<Buffer> {
  if (isS3Url(framesUrl)) {
    const key = s3KeyFromUrl(framesUrl);
    if (!key) throw new Error('pose frames: пустой ключ S3');
    return getObjectBuffer(key);
  }
  return downloadLegacyCloudinary(framesUrl);
}

/** Удалить кадры по ссылке из БД (S3 или старый Cloudinary). */
export async function deletePoseFrames(framesUrl: string): Promise<void> {
  if (isS3Url(framesUrl)) {
    await deleteS3ObjectStrict(framesUrl);
    return;
  }
  cloudinaryConfig();
  await cloudinary.uploader.destroy(rawAssetId(framesUrl), { resource_type: 'raw', type: 'authenticated' });
}

// ── Старые записи в Cloudinary (до 22.09) — только чтение и удаление для переноса ──

/**
 * Полный id raw-ассета в Cloudinary. При загрузке с format:'json.gz' Cloudinary
 * дописывал расширение к public_id (проверено на проде: хранится
 * «…/<id>.json.gz»), а в БД лежит id без расширения. Для raw скачивание и
 * удаление требуют именно полный id — с «format» отдельно API отвечал 404.
 */
export function rawAssetId(publicId: string): string {
  return publicId.endsWith(`.${RAW_FORMAT}`) ? publicId : `${publicId}.${RAW_FORMAT}`;
}

function cloudinaryConfig(): void {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary не настроен — старую запись не прочитать');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function downloadLegacyCloudinary(publicId: string): Promise<Buffer> {
  cloudinaryConfig();
  // format не передаём: у raw он уже в id (rawAssetId)
  const url = cloudinary.utils.private_download_url(rawAssetId(publicId), undefined as unknown as string, {
    resource_type: 'raw',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 600,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cloudinary download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
