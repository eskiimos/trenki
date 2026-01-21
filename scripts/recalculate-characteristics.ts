import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

/**
 * Скрипт для перерасчета характеристик существующих пользователей
 * по обновленной формуле (округление до десятых вместо целых)
 */
async function recalculateCharacteristics() {
  try {
    console.log('🔄 Начинаем перерасчет характеристик...\n');

    // Получаем всех пользователей с профилями, у которых есть rawPower
    const profiles = await prisma.profile.findMany({
      where: {
        rawPower: { not: null },
      },
      include: {
        user: true,
      },
    });

    console.log(`📊 Найдено профилей для перерасчета: ${profiles.length}\n`);

    let updated = 0;
    let skipped = 0;

    for (const profile of profiles) {
      const {
        id,
        rawPower,
        rawSpeed,
        rawEndurance,
        rawTechnique,
        rawFlexibility,
        kMastery,
      } = profile;

      // Пропускаем, если нет необходимых данных
      if (
        rawPower === null ||
        rawSpeed === null ||
        rawEndurance === null ||
        rawTechnique === null ||
        rawFlexibility === null ||
        kMastery === null
      ) {
        console.log(`⏭️  Пропущен профиль ${id} - нет исходных данных`);
        skipped++;
        continue;
      }

      // Рассчитываем новые характеристики
      let ratingPower = rawPower * kMastery;
      let ratingSpeed = rawSpeed * kMastery;
      let ratingEndurance = rawEndurance * kMastery;
      let ratingTechnique = rawTechnique * kMastery;
      let ratingFlexibility = rawFlexibility * kMastery;

      // Применяем ограничения [20, 75]
      ratingPower = Math.max(20, Math.min(75, ratingPower));
      ratingSpeed = Math.max(20, Math.min(75, ratingSpeed));
      ratingEndurance = Math.max(20, Math.min(75, ratingEndurance));
      ratingTechnique = Math.max(20, Math.min(75, ratingTechnique));
      ratingFlexibility = Math.max(20, Math.min(75, ratingFlexibility));

      // Рассчитываем potential (среднее арифметическое)
      const potential =
        (ratingPower +
          ratingSpeed +
          ratingEndurance +
          ratingTechnique +
          ratingFlexibility) /
        5;

      // Обновляем профиль (округляем до десятых)
      await prisma.profile.update({
        where: { id },
        data: {
          ratingPower: parseFloat(ratingPower.toFixed(1)),
          ratingSpeed: parseFloat(ratingSpeed.toFixed(1)),
          ratingEndurance: parseFloat(ratingEndurance.toFixed(1)),
          ratingTechnique: parseFloat(ratingTechnique.toFixed(1)),
          ratingFlexibility: parseFloat(ratingFlexibility.toFixed(1)),
          potential: parseFloat(potential.toFixed(1)),
        },
      });

      console.log(
        `✅ Обновлен профиль ${profile.user.username || profile.user.telegramId}:`
      );
      console.log(`   Сила: ${ratingPower.toFixed(1)}`);
      console.log(`   Скорость: ${ratingSpeed.toFixed(1)}`);
      console.log(`   Выносливость: ${ratingEndurance.toFixed(1)}`);
      console.log(`   Техника: ${ratingTechnique.toFixed(1)}`);
      console.log(`   Гибкость: ${ratingFlexibility.toFixed(1)}`);
      console.log(`   Потенциал: ${potential.toFixed(1)}\n`);

      updated++;
    }

    console.log('\n✨ Перерасчет завершен!');
    console.log(`   Обновлено: ${updated}`);
    console.log(`   Пропущено: ${skipped}`);
  } catch (error) {
    console.error('❌ Ошибка при перерасчете:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
recalculateCharacteristics();
