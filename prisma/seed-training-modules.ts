import { PrismaClient, ModuleType, LoadType, MuscleGroup, Complexity } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Создаю тренировочные модули...');

  // 1. РАЗМИНКА (WARMUP)
  const warmups = [
    {
      name: 'Динамическая растяжка - все тело',
      description: 'Комплекс динамических упражнений для разогрева всего тела',
      type: ModuleType.WARMUP,
      duration: 600, // 10 минут в секундах
      rpeMin: 2,
      rpeMax: 4,
      loadType: LoadType.DYNAMIC_STRETCH,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.BEGINNER,
    },
    {
      name: 'Кроссфит комплекс - разминка',
      description: 'Интенсивная разминка с кроссфит упражнениями',
      type: ModuleType.WARMUP,
      duration: 900, // 15 минут
      rpeMin: 3,
      rpeMax: 5,
      loadType: LoadType.AGILITY,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.AMATEUR,
    },
  ];

  // 2. ФИЗИЧЕСКАЯ ПОДГОТОВКА (FITNESS)
  const fitness = [
    {
      name: 'ОФП - Сила верха тела',
      description: 'Силовая тренировка для верхней части тела',
      type: ModuleType.FITNESS,
      duration: 1500, // 25 минут
      rpeMin: 6,
      rpeMax: 8,
      loadType: LoadType.MAX_STRENGTH,
      muscleGroup: MuscleGroup.UPPER_PUSH,
      complexity: Complexity.ADVANCED,
    },
    {
      name: 'ОФП - Выносливость',
      description: 'Тренировка на развитие выносливости',
      type: ModuleType.FITNESS,
      duration: 1200, // 20 минут
      rpeMin: 5,
      rpeMax: 7,
      loadType: LoadType.AEROBIC_ENDURANCE,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.AMATEUR,
    },
    {
      name: 'ЛФК - Восстановление колено',
      description: 'ЛФК упражнения для профилактики травм колена',
      type: ModuleType.FITNESS,
      duration: 1200, // 20 минут
      rpeMin: 2,
      rpeMax: 4,
      loadType: LoadType.PREHAB,
      muscleGroup: MuscleGroup.PREHAB_KNEE,
      complexity: Complexity.BEGINNER,
    },
    {
      name: 'СФП - Мощность низ тела',
      description: 'Взрывные упражнения для развития мощности ног',
      type: ModuleType.FITNESS,
      duration: 1500, // 25 минут
      rpeMin: 7,
      rpeMax: 9,
      loadType: LoadType.POWER,
      muscleGroup: MuscleGroup.LOWER_BODY,
      complexity: Complexity.ADVANCED,
    },
  ];

  // 3. ТЕХНИКА (TECHNIQUE)
  const technique = [
    {
      name: 'Техника катания - базовая',
      description: 'Базовые элементы техники катания на коньках',
      type: ModuleType.TECHNIQUE,
      duration: 1200, // 20 минут
      rpeMin: 3,
      rpeMax: 5,
      loadType: LoadType.TECHNICAL_SKILL,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.BEGINNER,
    },
    {
      name: 'Техника + скорость',
      description: 'Технические элементы с акцентом на скорость',
      type: ModuleType.TECHNIQUE,
      duration: 1500, // 25 минут
      rpeMin: 6,
      rpeMax: 8,
      loadType: LoadType.SPEED,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.ADVANCED,
    },
    {
      name: 'Техника + ловкость',
      description: 'Координационные упражнения с клюшкой',
      type: ModuleType.TECHNIQUE,
      duration: 1200, // 20 минут
      rpeMin: 4,
      rpeMax: 6,
      loadType: LoadType.AGILITY,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.AMATEUR,
    },
  ];

  // 4. ЗАМИНКА (COOLDOWN)
  const cooldowns = [
    {
      name: 'Растяжка - все тело',
      description: 'Статическая растяжка после тренировки',
      type: ModuleType.COOLDOWN,
      duration: 900, // 15 минут
      rpeMin: 1,
      rpeMax: 3,
      loadType: LoadType.STATIC_STRETCH,
      muscleGroup: MuscleGroup.FULL_BODY,
      complexity: Complexity.BEGINNER,
    },
    {
      name: 'ЛФК плечо - заминка',
      description: 'Упражнения для плечевого сустава',
      type: ModuleType.COOLDOWN,
      duration: 1200, // 20 минут
      rpeMin: 1,
      rpeMax: 3,
      loadType: LoadType.PREHAB,
      muscleGroup: MuscleGroup.PREHAB_SHOULDER,
      complexity: Complexity.BEGINNER,
    },
  ];

  // Создаем все модули
  const allModules = [...warmups, ...fitness, ...technique, ...cooldowns];

  for (const module of allModules) {
    await prisma.trainingModule.create({
      data: module,
    });
    console.log(`✅ Создан модуль: ${module.name}`);
  }

  console.log(`\n✨ Создано ${allModules.length} тренировочных модулей!`);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
