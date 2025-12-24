// Быстрый тест API анализа контента

async function testContentCheck() {
  console.log('🧪 ТЕСТИРУЕМ API АНАЛИЗА КОНТЕНТА\n');

  try {
    const response = await fetch('http://localhost:3000/api/admin/content-check');
    const data = await response.json();

    console.log('✅ Ответ получен!\n');

    console.log('📊 СТАТИСТИКА:');
    console.log(`   Всего видео: ${data.stats.total}`);
    console.log(`   🔥 Критичных пробелов: ${data.stats.criticalGaps}`);
    console.log(`   ⚠️  Важных пробелов: ${data.stats.importantGaps}`);
    console.log(`   💡 Желательных пробелов: ${data.stats.desirableGaps}`);

    console.log('\n📦 ПО МОДУЛЯМ:');
    console.log(`   💪 FITNESS: ${data.stats.byModule.FITNESS}`);
    console.log(`   🤸 WARMUP: ${data.stats.byModule.WARMUP}`);
    console.log(`   🧘 COOLDOWN: ${data.stats.byModule.COOLDOWN}`);
    console.log(`   ⚡ TECHNIQUE: ${data.stats.byModule.TECHNIQUE}`);

    console.log('\n🎯 ПО СТАТУСАМ:');
    console.log(`   🟢 RECOVERY: ${data.stats.byStatus.RECOVERY}`);
    console.log(`   🟡 DEVELOPMENT: ${data.stats.byStatus.DEVELOPMENT}`);
    console.log(`   🔴 PEAK: ${data.stats.byStatus.PEAK}`);

    console.log(`\n🎯 ТОП-5 ПРИОРИТЕТОВ:\n`);
    data.topPriorities.slice(0, 5).forEach((gap, i) => {
      const priorityEmoji = gap.priority >= 9 ? '🔥' : gap.priority >= 7 ? '⚠️' : '💡';
      console.log(`${i + 1}. ${priorityEmoji} [${gap.priority}/10] ${gap.moduleType} - ${gap.loadType}`);
      console.log(`   ${gap.reason}`);
      console.log(`   Текущее: ${gap.currentCount}/${gap.recommendedCount} видео`);
      if (gap.muscleGroup) {
        console.log(`   Мышечная группа: ${gap.muscleGroup}`);
      }
      console.log(`   Статус: ${gap.status}\n`);
    });

    console.log(`📋 Всего пробелов найдено: ${data.allGaps.length}`);
  } catch (error) {
    console.error('❌ ОШИБКА:', error.message);
  }
}

testContentCheck();
