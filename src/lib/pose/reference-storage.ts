import { promises as fs } from 'fs';
import path from 'path';
import { isPoseStorageConfigured, loadPoseFrames, savePoseFrames } from '@/lib/pose-storage';

// Хранение кадров эталона — в нашем S3 закрытым объектом (pose/references/…),
// не в БД (CLAUDE.md). Без S3 в разработке — файл в .pose-dev/ (для локальной
// проверки), в проде — честная ошибка.

const DEV_DIR = path.join(process.cwd(), '.pose-dev');
const DEV_PREFIX = 'dev:';

export class PoseStorageNotConfigured extends Error {}

function devAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export async function saveReferenceFrames(videoId: string, gzip: Buffer): Promise<string> {
  if (isPoseStorageConfigured()) return savePoseFrames('references', videoId, gzip);
  if (!devAllowed()) throw new PoseStorageNotConfigured('S3 не настроен');
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
  return loadPoseFrames(framesUrl);
}
