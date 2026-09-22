import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { getSessionUserId } from '@/lib/auth-server';
import { resolveVideoUrl } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { referenceSource } from '@/lib/pose/reference-source';
import { PoseStorageNotConfigured, saveReferenceFrames } from '@/lib/pose/reference-storage';
import {
  MAX_REFERENCE_GZIP_BYTES,
  MAX_REFERENCE_JSON_BYTES,
  POSE_REFERENCE_FORMAT,
  summarizeReference,
  validateReferenceDoc,
  type PoseReferenceDoc,
} from '@/lib/pose/reference';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ videoId: string }> };

const REFERENCE_SELECT = {
  model: true,
  fps: true,
  frameCount: true,
  durationSec: true,
  detectedRatio: true,
  legsVisibleRatio: true,
  updatedAt: true,
} as const;

/**
 * GET /api/admin/pose-references/[videoId] — видео, откуда брать кадры для
 * обработки (sourceUrl — через наш домен), откуда играть (playbackUrl) и
 * сводка эталона, если он уже есть. Только админ.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      duration: true,
      videoUrl: true,
      trainer: { select: { name: true, lastName: true } },
      poseReference: { select: REFERENCE_SELECT },
    },
  });
  if (!video) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
  const source = referenceSource(video.videoUrl);
  if (!source) {
    return NextResponse.json(
      { error: 'Это видео не лежит файлом в нашем хранилище (Kinescope или ещё обрабатывается)' },
      { status: 400 },
    );
  }
  const { videoUrl, poseReference, ...rest } = video;
  return NextResponse.json({
    video: rest,
    sourceUrl: source.kind === 's3' ? `/api/admin/pose-references/${video.id}/source` : source.path,
    playbackUrl: await resolveVideoUrl(videoUrl),
    reference: poseReference,
  });
}

/**
 * PUT /api/admin/pose-references/[videoId] — сохранить эталон, посчитанный в
 * браузере админа. Тело — gzip JSON (PoseReferenceDoc). Повторная обработка
 * перезаписывает эталон.
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  const { videoId } = await ctx.params;

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { id: true, videoUrl: true } });
  if (!video) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 });
  if (!referenceSource(video.videoUrl)) {
    return NextResponse.json({ error: 'Видео нельзя обработать' }, { status: 400 });
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_REFERENCE_GZIP_BYTES) {
    return NextResponse.json({ error: 'Слишком большой файл эталона' }, { status: 413 });
  }
  const gzip = Buffer.from(await request.arrayBuffer());
  if (gzip.length === 0 || gzip.length > MAX_REFERENCE_GZIP_BYTES) {
    return NextResponse.json({ error: 'Пустой или слишком большой файл эталона' }, { status: 413 });
  }

  let doc: PoseReferenceDoc;
  try {
    // Лимит распаковки — защита от «zip-бомбы»
    const json = gunzipSync(gzip, { maxOutputLength: MAX_REFERENCE_JSON_BYTES }).toString('utf8');
    doc = JSON.parse(json);
  } catch {
    return NextResponse.json({ error: 'Файл эталона повреждён' }, { status: 400 });
  }
  const invalid = validateReferenceDoc(doc);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const summary = summarizeReference(doc);
  try {
    const framesUrl = await saveReferenceFrames(video.id, gzip);
    const data = {
      framesUrl,
      formatVersion: POSE_REFERENCE_FORMAT,
      model: doc.model,
      fps: doc.fps,
      ...summary,
      createdById: await getSessionUserId(request),
    };
    const reference = await prisma.poseReference.upsert({
      where: { videoId: video.id },
      create: { videoId: video.id, ...data },
      update: data,
      select: REFERENCE_SELECT,
    });
    logger.info('pose reference saved', { videoId: video.id, ...summary, gzipBytes: gzip.length });
    return NextResponse.json({ reference });
  } catch (error) {
    if (error instanceof PoseStorageNotConfigured) {
      return NextResponse.json({ error: 'Хранилище (S3) не настроено' }, { status: 503 });
    }
    logger.error('pose reference save failed', error, { videoId: video.id });
    return NextResponse.json({ error: 'Не удалось сохранить эталон' }, { status: 500 });
  }
}
