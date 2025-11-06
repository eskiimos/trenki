import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const trainerId = searchParams.get('trainerId');

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
      },
      orderBy: { createdAt: 'desc' }
    });

    // Форматируем данные для фронтенда
    const formattedVideos = videos.map(video => ({
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
      equipment: video.equipment,
      level: video.level,
      viewsCount: video.viewsCount,
      likesCount: video.likesCount,
      trainer: {
        id: video.trainer.id,
        name: video.trainer.name,
        lastName: video.trainer.lastName,
        avatar: video.trainer.avatar || '/images/avatars/trainer-avatar-1.png',
        speciality: video.trainer.speciality,
      },
      createdAt: video.createdAt,
      isPublished: video.isPublished,
      rpeМин: video.rpeМин,
      rpeМакс: video.rpeМакс,
    }));

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
      rpeМин,
      rpeМакс,
      типМодуля,
      сложность,
      группаМышц,
    } = body;

    if (!title || !videoUrl || !category || !difficulty || !trainerId) {
      return NextResponse.json({ 
        error: 'title, videoUrl, category, difficulty, and trainerId are required' 
      }, { status: 400 });
    }

    // Преобразуем duration в число
    const durationNum = parseInt(duration) || 0;
    
    // Преобразуем RPE в числа
    const rpeМинNum = rpeМин ? parseInt(rpeМин.toString()) : null;
    const rpeМаксNum = rpeМакс ? parseInt(rpeМакс.toString()) : null;

    console.log('isPublished value:', isPublished, 'type:', typeof isPublished);

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
        rpeМин: rpeМинNum,
        rpeМакс: rpeМаксNum,
        moduleType: типМодуля || null,
        complexity: сложность || null,
        muscleGroup: группаМышц || null,
      },
      include: {
        trainer: true
      }
    });

    console.log('Created video with isPublished:', video.isPublished);

    // Автоматически создаём LoadType тег, если указан типНагрузки
    if (body.типНагрузки) {
      console.log('Creating LoadType tag for:', body.типНагрузки);
      
      // Маппинг типов нагрузки на LoadType enum (из prisma/schema.prisma)
      // Теперь типНагрузки приходит уже в формате enum (MAX_STRENGTH, POWER, etc)
      const loadTypeEnum = body.типНагрузки;
      
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
        console.warn(`⚠️ No LoadType mapping for: ${body.типНагрузки}`);
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
