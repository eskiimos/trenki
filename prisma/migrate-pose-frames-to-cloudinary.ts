/**
 * Бэкфилл старых pose-сессий: переносит frames из Postgres JSONB в Cloudinary.
 * Идемпотентный — пропускает сессии, у которых уже есть framesUrl.
 *
 * Запуск:
 *   tsx prisma/migrate-pose-frames-to-cloudinary.ts
 *   tsx prisma/migrate-pose-frames-to-cloudinary.ts --delete-source   # вычистить старый JSON
 *
 * Требует CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET в env.
 */

import { Prisma, PrismaClient } from '../src/generated/prisma';
import {
  POSE_FRAMES_ENCODING,
  encodePoseFrames,
  isPoseStorageConfigured,
  uploadPoseFrames,
} from '../src/lib/pose-storage';

const BATCH = 20;

async function main(): Promise<void> {
  if (!isPoseStorageConfigured()) {
    console.error('Cloudinary не настроен (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');
    process.exit(1);
  }

  const deleteSource = process.argv.includes('--delete-source');
  const prisma = new PrismaClient();

  const total = await prisma.poseSession.count({
    where: { framesUrl: null, NOT: { frames: { equals: Prisma.DbNull } } },
  });
  console.log(`pose-sessions для бэкфилла: ${total}`);

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Стримим небольшими батчами, чтобы не съесть память на JSON-полях.
  while (true) {
    const batch = await prisma.poseSession.findMany({
      where: { framesUrl: null, NOT: { frames: { equals: Prisma.DbNull } } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { id: true, fps: true, frames: true },
    });
    if (batch.length === 0) break;

    for (const row of batch) {
      processed += 1;
      const rawFrames = row.frames as unknown;
      const frames = Array.isArray(rawFrames) ? (rawFrames as number[][]) : null;
      if (!frames || frames.length === 0) {
        skipped += 1;
        continue;
      }
      try {
        const payload = encodePoseFrames({ fps: row.fps, frames });
        const publicId = await uploadPoseFrames(row.id, payload);
        await prisma.poseSession.update({
          where: { id: row.id },
          data: {
            framesUrl: publicId,
            framesEncoding: POSE_FRAMES_ENCODING,
            ...(deleteSource ? { frames: undefined } : {}),
          },
        });
        if (deleteSource) {
          // отдельным запросом, потому что Prisma не умеет SET NULL для Json через update
          // в типизации без `JsonNull`; используем raw для надёжности.
          await prisma.$executeRawUnsafe(
            'UPDATE "pose_sessions" SET "frames" = NULL WHERE "id" = $1',
            row.id,
          );
        }
        migrated += 1;
        console.log(
          `[${processed}/${total}] ${row.id}: ${frames.length} кадров, payload ${payload.length} bytes`,
        );
      } catch (e) {
        failed += 1;
        console.error(`[${processed}/${total}] ${row.id}: ОШИБКА`, e);
      }
    }
  }

  console.log(`\nГотово. migrated=${migrated}, skipped=${skipped}, failed=${failed}.`);
  if (deleteSource) {
    console.log('Старый JSON `frames` обнулён.');
  } else {
    console.log('Старый JSON сохранён. После проверки запустить повторно с --delete-source.');
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
