/**
 * Скрипт миграции данных из Prisma Accelerate -> новая БД reg.ru
 * Запуск: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/migrate-from-accelerate.ts
 */
import { PrismaClient } from '../src/generated/prisma';
import { withAccelerate } from '@prisma/extension-accelerate';

const OLD_DB_URL =
  'prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza181ZG9XUWVjNU1Bd1FlZWljVkVRdC0iLCJhcGlfa2V5IjoiMDFLNjE3OEYySk5IQTBXUFI5RkoyOVZGVDIiLCJ0ZW5hbnRfaWQiOiIyZjcyYjMyZWM0M2JhODg4NzhjYWRhNzVhZTgyNzJjYTE5ZmZmZWFmYjdlYzExMDIzMzdlZTY3MzZmOGQxOWEwIiwiaW50ZXJuYWxfc2VjcmV0IjoiOGQwZTQ2MzktM2NjYi00ODgzLTk0MWItNjEwYWNhOWFmYjQxIn0._NqmInkWY_M8upYGSfbz46gkomg_klV0s3nNjfp85Os';

const NEW_DB_URL =
  'postgresql://user1:%2FUCLwa6uf123@79.174.88.242:18878/db1?sslmode=require';

const oldPrisma = new PrismaClient({ datasourceUrl: OLD_DB_URL }).$extends(
  withAccelerate()
) as unknown as PrismaClient;

const newPrisma = new PrismaClient({ datasourceUrl: NEW_DB_URL });

async function main() {
  console.log('🚀 Начинаем миграцию данных из Prisma Accelerate -> reg.ru\n');

  // ── Тренеры ──────────────────────────────────────────────────────────────
  const trainers = await oldPrisma.trainer.findMany();
  console.log(`📦 Тренеры: ${trainers.length}`);
  for (const t of trainers) {
    await newPrisma.trainer.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }
  console.log('✅ Тренеры импортированы\n');

  // ── Теги ─────────────────────────────────────────────────────────────────
  const tags = await oldPrisma.tag.findMany();
  console.log(`📦 Теги: ${tags.length}`);
  for (const tag of tags) {
    await newPrisma.tag.upsert({
      where: { id: tag.id },
      update: tag,
      create: tag,
    });
  }
  console.log('✅ Теги импортированы\n');

  // ── Видео ─────────────────────────────────────────────────────────────────
  const videos = await oldPrisma.video.findMany();
  console.log(`📦 Видео: ${videos.length}`);
  for (const v of videos) {
    await newPrisma.video.upsert({
      where: { id: v.id },
      update: v,
      create: v,
    });
  }
  console.log('✅ Видео импортированы\n');

  // ── Тренировочные модули ──────────────────────────────────────────────────
  const modules = await oldPrisma.trainingModule.findMany();
  console.log(`📦 Тренировочные модули: ${modules.length}`);
  for (const m of modules) {
    await newPrisma.trainingModule.upsert({
      where: { id: m.id },
      update: m,
      create: m,
    });
  }
  console.log('✅ Модули импортированы\n');

  // ── Шортсы ────────────────────────────────────────────────────────────────
  const shorts = await oldPrisma.short.findMany();
  console.log(`📦 Шортсы: ${shorts.length}`);
  for (const s of shorts) {
    await newPrisma.short.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }
  console.log('✅ Шортсы импортированы\n');

  // ── Пользователи ─────────────────────────────────────────────────────────
  const users = await oldPrisma.user.findMany();
  console.log(`📦 Пользователи: ${users.length}`);
  for (const u of users) {
    await newPrisma.user.upsert({
      where: { telegramId: u.telegramId },
      update: u,
      create: u,
    });
  }
  console.log('✅ Пользователи импортированы\n');

  // ── Профили ──────────────────────────────────────────────────────────────
  const profiles = await oldPrisma.profile.findMany();
  console.log(`📦 Профили: ${profiles.length}`);
  for (const p of profiles) {
    await newPrisma.profile.upsert({
      where: { userId: p.userId },
      update: p,
      create: p,
    });
  }
  console.log('✅ Профили импортированы\n');

  // ── Итог ──────────────────────────────────────────────────────────────────
  const counts = {
    trainers: await newPrisma.trainer.count(),
    tags: await newPrisma.tag.count(),
    videos: await newPrisma.video.count(),
    shorts: await newPrisma.short.count(),
    modules: await newPrisma.trainingModule.count(),
    users: await newPrisma.user.count(),
    profiles: await newPrisma.profile.count(),
  };
  console.log('🎉 Миграция завершена! Данные в новой БД:');
  console.table(counts);

  await (oldPrisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
  await newPrisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});
