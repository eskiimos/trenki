/**
 * Разовый перенос pose-данных в наш S3 (22.09, решение владельца «все на s3»).
 * Не расписание — запускается вручную, повторный вызов безопасен:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "http://localhost:3000/api/cron/pose-storage-migrate[?deleteSource=1]"
 *
 * Что переносит (партиями по BATCH, пока есть что):
 *  - PoseSession.framesUrl из Cloudinary → S3 pose/sessions/<id>.json.gz;
 *  - PoseSession.frames (старый JSONB в БД) → S3, колонка очищается;
 *  - PoseReference.framesUrl из Cloudinary → S3 pose/references/<videoId>.json.gz.
 * deleteSource=1 — после успешного переноса удалить исходник в Cloudinary.
 * Без флага Cloudinary не трогаем: можно проверить, что всё открывается.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { logger } from '@/lib/logger';
import {
  POSE_FRAMES_ENCODING,
  deletePoseFrames,
  encodePoseFrames,
  isPoseStorageConfigured,
  loadPoseFrames,
  savePoseFrames,
} from '@/lib/pose-storage';

export const dynamic = 'force-dynamic';

const BATCH = 50;
const notS3 = { NOT: { framesUrl: { startsWith: 's3://' } } };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPoseStorageConfigured()) return NextResponse.json({ error: 'S3 не настроен' }, { status: 500 });
  const deleteSource = request.nextUrl.searchParams.get('deleteSource') === '1';

  const report = { sessionsCloudinary: 0, sessionsJsonb: 0, references: 0, failed: 0, deletedSources: 0 };

  // 1) Сессии атлетов из Cloudinary
  const cloudSessions = await prisma.poseSession.findMany({
    where: { framesUrl: { not: null }, ...notS3 },
    select: { id: true, framesUrl: true },
    take: BATCH,
  });
  for (const s of cloudSessions) {
    try {
      const gz = await loadPoseFrames(s.framesUrl!);
      const framesUrl = await savePoseFrames('sessions', s.id, gz);
      await prisma.poseSession.update({ where: { id: s.id }, data: { framesUrl, framesEncoding: POSE_FRAMES_ENCODING } });
      report.sessionsCloudinary++;
      if (deleteSource) {
        await deletePoseFrames(s.framesUrl!);
        report.deletedSources++;
      }
    } catch (error) {
      report.failed++;
      logger.error('pose migrate: session failed', error, { sessionId: s.id });
    }
  }

  // 2) Совсем старые сессии: кадры в JSONB-колонке
  const jsonbSessions = await prisma.poseSession.findMany({
    where: { framesUrl: null, NOT: { frames: { equals: Prisma.DbNull } } },
    select: { id: true, fps: true, frames: true },
    take: BATCH,
  });
  for (const s of jsonbSessions) {
    try {
      const frames = Array.isArray(s.frames) ? (s.frames as unknown as number[][]) : [];
      const framesUrl = await savePoseFrames('sessions', s.id, encodePoseFrames({ fps: s.fps ?? null, frames }));
      await prisma.poseSession.update({
        where: { id: s.id },
        data: { framesUrl, framesEncoding: POSE_FRAMES_ENCODING, frames: Prisma.DbNull },
      });
      report.sessionsJsonb++;
    } catch (error) {
      report.failed++;
      logger.error('pose migrate: jsonb session failed', error, { sessionId: s.id });
    }
  }

  // 3) Эталоны тренеров
  const refs = await prisma.poseReference.findMany({
    where: { NOT: [{ framesUrl: { startsWith: 's3://' } }, { framesUrl: { startsWith: 'dev:' } }] },
    select: { videoId: true, framesUrl: true },
    take: BATCH,
  });
  for (const r of refs) {
    try {
      const gz = await loadPoseFrames(r.framesUrl);
      const framesUrl = await savePoseFrames('references', r.videoId, gz);
      await prisma.poseReference.update({ where: { videoId: r.videoId }, data: { framesUrl } });
      report.references++;
      if (deleteSource) {
        await deletePoseFrames(r.framesUrl);
        report.deletedSources++;
      }
    } catch (error) {
      report.failed++;
      logger.error('pose migrate: reference failed', error, { videoId: r.videoId });
    }
  }

  const left = await Promise.all([
    prisma.poseSession.count({ where: { framesUrl: { not: null }, ...notS3 } }),
    prisma.poseSession.count({ where: { framesUrl: null, NOT: { frames: { equals: Prisma.DbNull } } } }),
    prisma.poseReference.count({ where: { NOT: [{ framesUrl: { startsWith: 's3://' } }, { framesUrl: { startsWith: 'dev:' } }] } }),
  ]);
  logger.info('pose storage migrate', { ...report, left });
  return NextResponse.json({ ...report, left: { sessionsCloudinary: left[0], sessionsJsonb: left[1], references: left[2] } });
}
