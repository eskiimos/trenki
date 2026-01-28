import { prisma } from '../src/lib/prisma';
import { LoadType, MuscleGroup, Complexity, TrainingGoal, TagType } from '../src/generated/prisma';

interface TagData {
  name: string;
  displayName: string;
  description: string;
  tagType: TagType;
  loadType?: LoadType;
  muscleGroup?: MuscleGroup;
  complexity?: Complexity;
  trainingGoal?: TrainingGoal;
  icon: string;
  color: string;
  order: number;
}

const allTags: TagData[] = [
  // ========== ТИП НАГРУЗКИ (LOAD) ==========
  {
    name: 'speed',
    displayName: 'Скорость',
    description: '30-45" интервальной работы',
    tagType: 'LOAD',
    loadType: 'SPEED',
    icon: '⚡',
    color: '#FFD700',
    order: 101,
  },
  {
    name: 'power',
    displayName: 'Мощность',
    description: 'Взрывные упражнения с плиометрикой',
    tagType: 'LOAD',
    loadType: 'POWER',
    icon: '💥',
    color: '#FF4500',
    order: 102,
  },
  {
    name: 'max_strength',
    displayName: 'Максимальная сила',
    description: 'Статическая/изометрическая нагрузка, пиковое проявление силы',
    tagType: 'LOAD',
    loadType: 'MAX_STRENGTH',
    icon: '💪',
    color: '#DC143C',
    order: 103,
  },
  {
    name: 'strength_endurance',
    displayName: 'Силовая выносливость',
    description: 'Выносливость силового характера',
    tagType: 'LOAD',
    loadType: 'STRENGTH_ENDURANCE',
    icon: '🏋️',
    color: '#4169E1',
    order: 104,
  },
  {
    name: 'anaerobic_endurance',
    displayName: 'Анаэробная выносливость',
    description: 'Выносливость при высокоинтенсивной работе',
    tagType: 'LOAD',
    loadType: 'ANAEROBIC_ENDURANCE',
    icon: '🔥',
    color: '#FF6347',
    order: 105,
  },
  {
    name: 'aerobic_endurance',
    displayName: 'Аэробная выносливость',
    description: 'Выносливость при длительной работе средней интенсивности',
    tagType: 'LOAD',
    loadType: 'AEROBIC_ENDURANCE',
    icon: '🫁',
    color: '#00CED1',
    order: 106,
  },
  {
    name: 'agility',
    displayName: 'Ловкость',
    description: 'Координация, баланс и равновесие',
    tagType: 'LOAD',
    loadType: 'AGILITY',
    icon: '🤸',
    color: '#9370DB',
    order: 107,
  },
  {
    name: 'mobility',
    displayName: 'Мобильность',
    description: 'Вращательные функции суставов и мышц',
    tagType: 'LOAD',
    loadType: 'MOBILITY',
    icon: '🔄',
    color: '#20B2AA',
    order: 108,
  },
  {
    name: 'static_stretch',
    displayName: 'Статическая растяжка',
    description: 'Растяжка с удержанием позиции',
    tagType: 'LOAD',
    loadType: 'STATIC_STRETCH',
    icon: '🧘',
    color: '#48D1CC',
    order: 109,
  },
  {
    name: 'dynamic_stretch',
    displayName: 'Динамическая растяжка',
    description: 'Растяжка с движением',
    tagType: 'LOAD',
    loadType: 'DYNAMIC_STRETCH',
    icon: '🤾',
    color: '#40E0D0',
    order: 110,
  },
  {
    name: 'prehab',
    displayName: 'ЛФК',
    description: 'Восстановление и предотвращение травм',
    tagType: 'LOAD',
    loadType: 'PREHAB',
    icon: '🩹',
    color: '#32CD32',
    order: 111,
  },
  {
    name: 'technical_skill',
    displayName: 'Техника',
    description: 'Технические элементы',
    tagType: 'LOAD',
    loadType: 'TECHNICAL_SKILL',
    icon: '🎯',
    color: '#FFD700',
    order: 112,
  },

  // ========== НАПРАВЛЕНИЕ НАГРУЗКИ (MUSCLE) ==========
  {
    name: 'lower_body',
    displayName: 'Низ тела',
    description: 'Ноги, ягодицы, колени, голеностоп',
    tagType: 'MUSCLE',
    muscleGroup: 'LOWER_BODY',
    icon: '🦵',
    color: '#FF8C00',
    order: 201,
  },
  {
    name: 'upper_pull',
    displayName: 'Верх тела (тяга)',
    description: 'Спина, бицепс, задние дельты',
    tagType: 'MUSCLE',
    muscleGroup: 'UPPER_PULL',
    icon: '💪',
    color: '#1E90FF',
    order: 202,
  },
  {
    name: 'upper_push',
    displayName: 'Верх тела (жим)',
    description: 'Грудь, трицепс, передние/средние дельты',
    tagType: 'MUSCLE',
    muscleGroup: 'UPPER_PUSH',
    icon: '✊',
    color: '#FF4500',
    order: 203,
  },
  {
    name: 'core_stability',
    displayName: 'Кор (стабилизация)',
    description: 'Статическая работа кора',
    tagType: 'MUSCLE',
    muscleGroup: 'CORE_STABILITY',
    icon: '🛡️',
    color: '#8B4513',
    order: 204,
  },
  {
    name: 'core_dynamics',
    displayName: 'Кор (динамика)',
    description: 'Динамическая работа кора, ротационные движения',
    tagType: 'MUSCLE',
    muscleGroup: 'CORE_DYNAMICS',
    icon: '🌀',
    color: '#CD853F',
    order: 205,
  },
  {
    name: 'prehab_shoulder',
    displayName: 'ЛФК плечо',
    description: 'Ротаторы плеча, профилактика, растяжка и мобильность плечевого сустава',
    tagType: 'MUSCLE',
    muscleGroup: 'PREHAB_SHOULDER',
    icon: '🤕',
    color: '#32CD32',
    order: 206,
  },
  {
    name: 'prehab_knee',
    displayName: 'ЛФК колено',
    description: 'Профилактика травм коленей, укрепление связок',
    tagType: 'MUSCLE',
    muscleGroup: 'PREHAB_KNEE',
    icon: '🦴',
    color: '#3CB371',
    order: 207,
  },
  {
    name: 'prehab_back',
    displayName: 'ЛФК спина',
    description: 'Профилактика болей в спине, стречинг',
    tagType: 'MUSCLE',
    muscleGroup: 'PREHAB_BACK',
    icon: '🧘‍♂️',
    color: '#228B22',
    order: 208,
  },
  {
    name: 'full_body',
    displayName: 'Все тело',
    description: 'Упражнения, комплексно нагружающие организм',
    tagType: 'MUSCLE',
    muscleGroup: 'FULL_BODY',
    icon: '🏃',
    color: '#FF1493',
    order: 209,
  },

  // ========== СЛОЖНОСТЬ (COMPLEXITY) ==========
  {
    name: 'beginner',
    displayName: 'Новичок',
    description: 'Для начинающих спортсменов',
    tagType: 'COMPLEXITY',
    complexity: 'BEGINNER',
    icon: '🌱',
    color: '#90EE90',
    order: 301,
  },
  {
    name: 'amateur',
    displayName: 'Любитель',
    description: 'Для спортсменов среднего уровня',
    tagType: 'COMPLEXITY',
    complexity: 'AMATEUR',
    icon: '🌿',
    color: '#FFD700',
    order: 302,
  },
  {
    name: 'advanced',
    displayName: 'Продвинутый',
    description: 'Для опытных спортсменов',
    tagType: 'COMPLEXITY',
    complexity: 'ADVANCED',
    icon: '🌳',
    color: '#FF8C00',
    order: 303,
  },
  {
    name: 'pro',
    displayName: 'Профессионал',
    description: 'Для профессиональных спортсменов',
    tagType: 'COMPLEXITY',
    complexity: 'PRO',
    icon: '🏆',
    color: '#FF4500',
    order: 304,
  },

  // ========== ЦЕЛЬ/СОСТОЯНИЕ (GOAL) ==========
  {
    name: 'recovery',
    displayName: 'Восстановление',
    description: 'Для периода восстановления и реабилитации',
    tagType: 'GOAL',
    icon: '🛌',
    color: '#87CEEB',
    order: 401,
  },
  {
    name: 'development',
    displayName: 'Развитие',
    description: 'Для периода активного развития и прогресса',
    tagType: 'GOAL',
    icon: '📈',
    color: '#4169E1',
    order: 402,
  },
  {
    name: 'peak',
    displayName: 'Пик формы',
    description: 'Для пика формы и соревновательного периода',
    tagType: 'GOAL',
    icon: '⛰️',
    color: '#DC143C',
    order: 403,
  },
];

async function seedAllTags() {
  console.log('🌱 Начинаем заполнение всех тегов...\n');

  try {
    // Удаляем старые теги
    await prisma.tag.deleteMany({});
    console.log('🗑️  Старые теги удалены\n');

    // Группируем теги по типам
    const loadTags = allTags.filter(t => t.tagType === 'LOAD');
    const muscleTags = allTags.filter(t => t.tagType === 'MUSCLE');
    const complexityTags = allTags.filter(t => t.tagType === 'COMPLEXITY');
    const goalTags = allTags.filter(t => t.tagType === 'GOAL');

    // Создаём теги по категориям
    console.log('📊 ТИП НАГРУЗКИ (LOAD):');
    for (const tag of loadTags) {
      const created = await prisma.tag.create({ data: tag });
      console.log(`  ✅ ${created.displayName} (${created.name})`);
    }

    console.log('\n💪 НАПРАВЛЕНИЕ НАГРУЗКИ (MUSCLE):');
    for (const tag of muscleTags) {
      const created = await prisma.tag.create({ data: tag });
      console.log(`  ✅ ${created.displayName} (${created.name})`);
    }

    console.log('\n🎯 СЛОЖНОСТЬ (COMPLEXITY):');
    for (const tag of complexityTags) {
      const created = await prisma.tag.create({ data: tag });
      console.log(`  ✅ ${created.displayName} (${created.name})`);
    }

    console.log('\n🎪 ЦЕЛЬ/СОСТОЯНИЕ (GOAL):');
    for (const tag of goalTags) {
      const created = await prisma.tag.create({ data: tag });
      console.log(`  ✅ ${created.displayName} (${created.name})`);
    }

    console.log(`\n🎉 Успешно создано ${allTags.length} тегов!`);
    console.log(`   - Тип нагрузки: ${loadTags.length}`);
    console.log(`   - Направление нагрузки: ${muscleTags.length}`);
    console.log(`   - Сложность: ${complexityTags.length}`);
    console.log(`   - Цель/состояние: ${goalTags.length}`);
  } catch (error) {
    console.error('❌ Ошибка при создании тегов:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAllTags();
