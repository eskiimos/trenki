import { promises as fs } from 'fs';
import path from 'path';
import { downloadPoseFrames, isPoseStorageConfigured, uploadPoseFrames } from '@/lib/pose-storage';

// Хранение кадров эталона. Как и pose-сессии — только в Cloudinary (raw,
// authenticated), не в БД (CLAUDE.md). Без Cloudinary в разработке — файл в
// .pose-dev/ (для локальной проверки), в проде — честная ошибка.

const FOLDER = 'trenki/pose-references';
const DEV_DIR = path.join(process.cwd(), '.pose-dev');
const DEV_PREFIX = 'dev:';

export class PoseStorageNotConfigured extends Error {}

function devAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export async function saveReferenceFrames(videoId: string, gzip: Buffer): Promise<string> {
  if (isPoseStorageConfigured()) return uploadPoseFrames(videoId, gzip, { folder: FOLDER });
  if (!devAllowed()) throw new PoseStorageNotConfigured('Cloudinary не настроен');
  await fs.mkdir(DEV_DIR, { recursive: true });
  const name = `${videoId.replace(/[^a-zA-Z0-9_-]/g, '')}.json.gz`;
  await fs.writeFile(path.join(DEV_DIR, name), gzip);
  return `${DEV_PREFIX}${name}`;
}

export async function loadReferenceFrames(framesUrl: string): Promise<Buffer> {
  if (framesUrl.startsWith(DEV_PREFIX)) {
    if (!devAllowed()) throw new PoseStorageNotConfigured('dev-файл в проде');
    return fs.readFile(path.join(DEV_DIR, path.basename(framesUrl.slice(DEV_PREFIX.length))));
  }
  return downloadPoseFrames(framesUrl);
}
