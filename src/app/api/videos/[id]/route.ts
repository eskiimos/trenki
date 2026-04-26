import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        videoUrl: true,
        thumbnail: true,
        duration: true,
        likesCount: true,
        category: true,
        difficulty: true,
        level: true,
        equipment: true,
        tags: true,
        moduleType: true,
        loadType: true,
        muscleGroup: true,
        complexity: true,
        rpeMin: true,
        rpeMax: true,
        ageGroups: true,
        trainingGoals: true,
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            speciality: true,
            avatar: true,
          }
        }
      }
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch (error: any) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { 
      title, 
      description, 
      duration, 
      videoUrl, 
      thumbnail, 
      category, 
      difficulty, 
      trainerId,
      tags,
      equipment,
      level,
      isPublished,
      rpeMin,
      rpeMax,
      moduleType: moduleTypeRaw,
      complexity,
      muscleGroup,
      ageGroups,
      trainingGoals,
      audience,
    } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

        // Преобразуем RPE в числа
    const rpeMinNum = rpeMin ? parseInt(rpeMin.toString()) : null;
    const rpeMaxNum = rpeMax ? parseInt(rpeMax.toString()) : null;

    // Маппинг русских названий модулей в enum ModuleType
    const moduleTypeMap: Record<string, string> = {
      'Разминка': 'WARMUP',
      'ОФП': 'FITNESS',
      'Техника': 'TECHNIQUE',
      'Заминка': 'COOLDOWN',
    };
    
    const moduleTypeEnum = moduleTypeRaw ? moduleTypeMap[moduleTypeRaw] || moduleTypeRaw : null;
    console.log('moduleTypeRaw:', moduleTypeRaw, '→ moduleTypeEnum:', moduleTypeEnum);

    // Маппинг русских названий сложности в enum Complexity
    const complexityMap: Record<string, string> = {
      'Новичок': 'BEGINNER',
      'Любитель': 'AMATEUR',
      'Продвинутый': 'ADVANCED',
      'Профи': 'PRO',
    };
    const complexityEnum = complexity ? complexityMap[complexity] || complexity : null;

    // Маппинг русских названий групп мышц в enum MuscleGroup
    const muscleGroupMap: Record<string, string> = {
      'Все тело': 'FULL_BODY',
      'Низ тела': 'LOWER_BODY',
      'Верх тяга': 'UPPER_PULL',
      'Верх жим': 'UPPER_PUSH',
      'Кор стабилизация': 'CORE_STABILITY',
      'Кор динамика': 'CORE_DYNAMICS',
      'ЛФК плечо': 'PREHAB_SHOULDER',
      'ЛФК колено': 'PREHAB_KNEE',
      'ЛФК спина': 'PREHAB_BACK',
    };
    const muscleGroupEnum = muscleGroup ? muscleGroupMap[muscleGroup] || muscleGroup : null;

    // Обрабатываем loadType - если пустая строка, то null
    const loadTypeValue = body.loadType && body.loadType !== '' ? body.loadType : null;
    
    // Обрабатываем массивы для Алгоритма 2.0
    const ageGroupsArray = Array.isArray(ageGroups) ? ageGroups : [];
    const trainingGoalsArray = Array.isArray(trainingGoals) ? trainingGoals : [];
    
    console.log('Updating video - loadType:', body.loadType, '→', loadTypeValue);
    console.log('Updating video - ageGroups:', ageGroupsArray);
    console.log('Updating video - trainingGoals:', trainingGoalsArray);

    // Обновляем видео
    const video = await prisma.video.update({
      where: { id },
      data: {
        title,
        description: description || '',
        duration: typeof duration === 'string' ? parseInt(duration) : duration,
        videoUrl,
        thumbnail: thumbnail || '',
        category,
        difficulty,
        trainerId,
        tags: tags || [],
        equipment: equipment || [],
        level: level || '',
        isPublished: isPublished !== undefined ? isPublished : true,
        rpeMin: rpeMinNum,
        rpeMax: rpeMaxNum,
        moduleType: moduleTypeEnum as any,
        complexity: complexityEnum as any,
        muscleGroup: muscleGroupEnum as any,
        loadType: loadTypeValue as any,
        ageGroups: ageGroupsArray,
        trainingGoals: trainingGoalsArray,
        audience: audience || undefined,
      },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            speciality: true,
          },
        },
      },
    });

    // Обновляем LoadType тег, если указан loadType
    if (body.loadType) {
      console.log('Updating LoadType tag for:', body.loadType);
      
      // Теперь loadType приходит уже в формате enum (MAX_STRENGTH, POWER, etc)
      const loadTypeEnum = body.loadType;
      
      if (loadTypeEnum) {
        // Удаляем старые LoadType теги
        const oldLoadTypeTags = await prisma.tag.findMany({
          where: { 
            tagType: 'LOAD',
            videos: {
              some: { videoId: id }
            }
          }
        });

        if (oldLoadTypeTags.length > 0) {
          await prisma.videoTag.deleteMany({
            where: {
              videoId: id,
              tagId: { in: oldLoadTypeTags.map(t => t.id) }
            }
          });
        }

        // Находим LoadType тег по имени
        const tagName = `LoadType:${loadTypeEnum}`;
        let loadTypeTag = await prisma.tag.findUnique({
          where: { name: tagName }
        });

        // Если не найден, создаём
        if (!loadTypeTag) {
          loadTypeTag = await prisma.tag.create({
            data: {
              name: tagName,
              displayName: loadTypeEnum,
              tagType: 'LOAD',
              loadType: loadTypeEnum as any,
              order: 0,
            }
          });
        }

        // Создаём новую связь VideoTag
        await prisma.videoTag.upsert({
          where: {
            videoId_tagId: {
              videoId: id,
              tagId: loadTypeTag.id,
            }
          },
          create: {
            videoId: id,
            tagId: loadTypeTag.id,
          },
          update: {},
        });

        console.log(`✅ LoadType tag updated: ${tagName} for video ${id}`);
      } else {
        console.warn(`⚠️ No LoadType mapping for: ${body.loadType}`);
      }
    }

    return NextResponse.json({ 
      success: true,
      video,
      message: 'Video updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating video:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await params;

    // Удаляем/отвязываем все связанные записи, чтобы не падать на ограничениях FK
    await prisma.$transaction([
      // Лайки к видео
      prisma.videoLike.deleteMany({ where: { videoId: id } }),
      // Избранные
      prisma.favoriteVideo.deleteMany({ where: { videoId: id } }),
      // Сессии тренировок по видео
      prisma.trainingSession.deleteMany({ where: { videoId: id } }),
      // Видео в активных/прошлых сессиях тренировок
      prisma.workoutSessionVideo.deleteMany({ where: { videoId: id } }),
      // Теги видео (на всякий случай, хотя стоит CASCADE)
      prisma.videoTag.deleteMany({ where: { videoId: id } }),
      // Запланированные тренировки с этим видео (на всякий случай, стоит CASCADE)
      prisma.scheduledWorkout.deleteMany({ where: { videoId: id } }),
      // Модули, ссылающиеся на это видео — отвязываем
      prisma.trainingModule.updateMany({ where: { videoId: id }, data: { videoId: null } }),
    ]);

    // И только после этого удаляем саму запись видео
    await prisma.video.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}
