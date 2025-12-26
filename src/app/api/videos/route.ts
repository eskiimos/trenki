import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const trainerId = searchParams.get('trainerId');
    const userId = searchParams.get('userId');

    const where: any = {
      isPublished: true, // показываем только опубликованные видео
    };
    
    if (category && category !== 'all') {
      where.category = category.toUpperCase();
    }
    if (difficulty) {
      where.difficulty = difficulty.toUpperCase();
    }
    if (trainerId) {
      where.trainerId = trainerId;
    }

    const videos = await prisma.video.findMany({
      where,
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            avatar: true,
            speciality: true,
          },
        },
        videoTags: {
          include: {
            tag: true
          }
        },
        _count: {
          select: {
            likes: true, // Подсчитываем реальные лайки из VideoLike
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Форматируем данные для фронтенда
    const formattedVideos = videos.map(video => {
      // Extract load types from video tags
      const loadTypes = video.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD' && vt.tag.loadType)
        .map(vt => vt.tag.loadType);

      return {
        id: video.id,
        title: video.title,
        description: video.description,
        duration: video.duration, // Возвращаем как число (секунды)
        durationFormatted: formatDuration(video.duration), // Форматированная строка для отображения
        videoUrl: video.videoUrl,
        thumbnail: video.thumbnail,
        category: video.category,
        difficulty: video.difficulty,
        tags: video.tags,
        loadTypes, // Add load types to response
        equipment: video.equipment,
        level: video.level,
        viewsCount: video.viewsCount,
        likesCount: video._count.likes, // Реальное количество лайков из VideoLike
        trainer: {
          id: video.trainer.id,
          name: video.trainer.name,
          lastName: video.trainer.lastName,
          avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
          speciality: video.trainer.speciality,
        },
        createdAt: video.createdAt,
        isPublished: video.isPublished,
        rpeMin: video.rpeMin,
        rpeMax: video.rpeMax,
      };
    });

    // Обновляем активность пользователя, если он авторизован
    if (userId) {
      await updateUserActivity(userId);
    }

    return NextResponse.json({ videos: formattedVideos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Функция для форматирования продолжительности (секунды -> мм:сс)
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received body:', body);
    
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
    } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

    // Преобразуем duration в число
    const durationNum = parseInt(duration) || 0;
    
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

    console.log('isPublished value:', isPublished, 'type:', typeof isPublished);
    console.log('moduleTypeRaw:', moduleTypeRaw, '→ moduleTypeEnum:', moduleTypeEnum);

    const video = await prisma.video.create({
      data: {
        title,
        description,
        duration: durationNum,
        videoUrl,
        thumbnail: thumbnail || null,
        category,
        difficulty,
        trainerId,
        tags: tags || [],
        equipment: equipment || [],
        level: level || null,
        isPublished: isPublished ?? false,
        rpeMin: rpeMinNum,
        rpeMax: rpeMaxNum,
        moduleType: moduleTypeEnum as any,
        complexity: complexityEnum as any,
        muscleGroup: muscleGroupEnum as any,
        loadType: body.loadType as any,
      },
      include: {
        trainer: true
      }
    });

    console.log('Created video with isPublished:', video.isPublished);

    // Автоматически создаём LoadType тег, если указан loadType
    if (body.loadType) {
      console.log('Creating LoadType tag for:', body.loadType);
      
      // Маппинг типов нагрузки на LoadType enum (из prisma/schema.prisma)
      // Теперь loadType приходит уже в формате enum (MAX_STRENGTH, POWER, etc)
      const loadTypeEnum = body.loadType;
      
      if (loadTypeEnum) {
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

        // Создаём связь VideoTag
        await prisma.videoTag.upsert({
          where: {
            videoId_tagId: {
              videoId: video.id,
              tagId: loadTypeTag.id,
            }
          },
          create: {
            videoId: video.id,
            tagId: loadTypeTag.id,
          },
          update: {},
        });

        console.log(`✅ LoadType tag created: ${tagName} for video ${video.id}`);
      } else {
        console.warn(`⚠️ No LoadType mapping for: ${body.loadType}`);
      }
    }

    return NextResponse.json({ video, id: video.id });
  } catch (error: any) {
    console.error('Error creating video:', error);
    console.error('Error details:', error.message);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
}
