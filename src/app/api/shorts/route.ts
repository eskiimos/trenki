import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateUserActivity } from '@/lib/updateUserActivity';
import { requireAdminAsync } from '@/lib/admin-session';
import { getSessionUserId } from '@/lib/auth-server';
import { isRawUploadUrl } from '@/lib/media/url-plan';
import { hasJobForSource } from '@/lib/media/jobs';
import { kickMediaWorker } from '@/lib/media/worker';

// GET - получить все опубликованные shorts (публичное, isLiked заполняется только при наличии сессии)
export async function GET(request: NextRequest) {
  try {
    const sessionUserId = await getSessionUserId(request);
    const { searchParams } = new URL(request.url);
    const trainerId = searchParams.get('trainerId');
    const audience = searchParams.get('audience'); // HOCKEY | ADAPTIVE
    // limit — для ленты на главной (правка владельца: там нужны только первые
    // несколько, остальное в каталоге). Без параметра — как раньше, всё.
    const limitRaw = Number(searchParams.get('limit'));
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : undefined;

    const whereClause: any = { isPublished: true };
    if (audience === 'ADAPTIVE') {
      whereClause.audience = { in: ['ADAPTIVE', 'ALL'] };
    } else if (audience === 'HOCKEY') {
      whereClause.audience = { in: ['HOCKEY', 'ALL'] };
    }
    if (trainerId) {
      whereClause.trainerId = trainerId;
    }

    const shorts = await prisma.short.findMany({
      where: whereClause,
      orderBy: [
        { isPinned: 'desc' }, // закреплённый тренёк — первым
        { order: 'asc' },
        { createdAt: 'desc' }
      ],
      ...(limit ? { take: limit } : {}),
    });

    const shortsWithData = await Promise.all(
      shorts.map(async (short) => {
        let trainer = null;
        if (short.trainerId) {
          trainer = await prisma.trainer.findUnique({
            where: { id: short.trainerId },
            select: { id: true, name: true, lastName: true, avatar: true }
          });
        }

        let isLiked = false;
        if (sessionUserId) {
          const like = await prisma.shortLike.findUnique({
            where: {
              userId_shortId: { userId: sessionUserId, shortId: short.id }
            }
          });
          isLiked = !!like;
        }

        const commentsCount = await prisma.shortComment.count({
          where: { shortId: short.id }
        });

        return { ...short, trainer, isLiked, commentsCount };
      })
    );

    if (sessionUserId) {
      await updateUserActivity(sessionUserId);
    }

    return NextResponse.json({ shorts: shortsWithData });
  } catch (error) {
    console.error('Error fetching shorts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - создать новый short
export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json();

    if (!body?.title || !body?.videoUrl) {
      return NextResponse.json(
        { error: 'title и videoUrl обязательны' },
        { status: 400 }
      );
    }

    // Сырой исходник пережимается воркером; до конца обработки шортс не
    // публикуется (см. src/lib/media/url-plan.ts).
    const needsProcessing = isRawUploadUrl(body.videoUrl);
    if (needsProcessing && (await hasJobForSource(body.videoUrl))) {
      return NextResponse.json(
        { error: 'Этот файл уже использован — загрузите файл заново' },
        { status: 400 },
      );
    }
    const requestedPublish = body.isPublished ?? true;

    // Шортс и задача обработки — одной транзакцией (без «сырого» шортса без задачи).
    const short = await prisma.$transaction(async (tx) => {
      const created = await tx.short.create({
        data: {
          title: body.title,
          description: body.description || '',
          videoUrl: body.videoUrl,
          thumbnail: body.thumbnail || '',
          trainerId: body.trainerId || null,
          tags: body.tags || [],
          isPublished: needsProcessing ? false : requestedPublish,
          order: body.order || 0,
          audience: body.audience || 'HOCKEY',
        },
      });
      if (needsProcessing) {
        await tx.mediaJob.create({
          data: {
            targetType: 'SHORT',
            targetId: created.id,
            sourceUrl: body.videoUrl,
            publishOnReady: Boolean(requestedPublish),
          },
        });
      }
      return created;
    });
    if (needsProcessing) kickMediaWorker({ immediate: true });

    return NextResponse.json({ short, processing: needsProcessing });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Тренька с этим файлом уже сохранена — обновите список' },
        { status: 409 },
      );
    }
    console.error('Error creating short:', error);
    return NextResponse.json({ 
      error: 'Failed to create short',
    }, { status: 500 });
  }
}
