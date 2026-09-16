import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { getSessionUserId } from '@/lib/auth-server';
import { rateLimit } from '@/lib/coach/rate-limit';
import { deleteS3ObjectsByUrls, isOwnStorageUrl } from '@/lib/s3';
import { isRawUploadUrl, planUrlUpdate } from '@/lib/media/url-plan';
import {
  cancelMediaJobsForTarget,
  enqueueMediaJob,
  hasJobForSource,
  setPublishIntent,
} from '@/lib/media/jobs';
import { kickMediaWorker } from '@/lib/media/worker';

// GET - получить short по ID (публичное, isLiked при наличии сессии)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = await getSessionUserId(request);
    const { id } = await context.params;

    const short = await prisma.short.findUnique({
      where: { id },
    });

    if (!short) {
      return NextResponse.json({ error: 'Short not found' }, { status: 404 });
    }

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
          userId_shortId: { userId: sessionUserId, shortId: id }
        }
      });
      isLiked = !!like;
    }

    const commentsCount = await prisma.shortComment.count({
      where: { shortId: id }
    });

    return NextResponse.json({
      short: { ...short, trainer, isLiked, commentsCount }
    });
  } catch (error) {
    console.error('Error fetching short:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - обновить short
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.short.findUnique({
      where: { id },
      select: { videoUrl: true, isPublished: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Short not found' }, { status: 404 });
    }
    const requestedPublish = typeof body.isPublished === 'boolean' ? body.isPublished : undefined;
    const incomingUrl = typeof body.videoUrl === 'string' ? body.videoUrl : undefined;
    // Замена файла и незавершённая обработка: см. правила в src/lib/media/url-plan.ts.
    const urlPlan = planUrlUpdate({
      current: existing.videoUrl,
      incoming: incomingUrl,
      requestedPublish,
      incomingHasJob:
        isRawUploadUrl(incomingUrl) && incomingUrl !== existing.videoUrl ? await hasJobForSource(incomingUrl) : false,
      currentInOwnStorage: isOwnStorageUrl(existing.videoUrl),
    });

    // Отмена задач и новое намерение публикации — ДО записи: воркер применяет
    // результат под блокировкой строки задачи (см. videos/[id] PUT).
    if (!urlPlan.enqueueSource) {
      if (urlPlan.cancelJobs) await cancelMediaJobsForTarget('SHORT', id);
      if (urlPlan.updatePublishIntent && requestedPublish !== undefined) {
        await setPublishIntent('SHORT', id, requestedPublish);
      }
    }

    // Частичное обновление: отсутствующие поля не трогаем (undefined для Prisma
    // = «оставить как есть»). Это позволяет админке слать точечные правки,
    // например { isPinned } из тумблера закрепления, не затирая теги/тренера.
    // CAS по videoUrl: воркер мог подменить файл между чтением и записью.
    const { count: updated } = await prisma.short.updateMany({
      where: { id, videoUrl: existing.videoUrl },
      data: {
        title: body.title,
        description: body.description,
        videoUrl: urlPlan.videoUrl,
        // Обложка присылается, только если админ её менял (undefined — не
        // трогать: её мог поставить воркер, пока форма была открыта).
        thumbnail: typeof body.thumbnail === 'string' ? body.thumbnail : undefined,
        trainerId: body.trainerId !== undefined ? (body.trainerId || null) : undefined,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
        isPublished: urlPlan.isPublished,
        isPinned: typeof body.isPinned === 'boolean' ? body.isPinned : undefined,
        order: typeof body.order === 'number' ? body.order : undefined,
        audience: body.audience || undefined,
      },
    });
    if (updated !== 1) {
      return NextResponse.json(
        { error: 'Тренька только что обновилась (закончилась обработка файла) — нажмите «Обновить» ещё раз' },
        { status: 409 },
      );
    }
    const short = await prisma.short.findUniqueOrThrow({ where: { id } });

    if (urlPlan.enqueueSource) {
      await enqueueMediaJob({
        targetType: 'SHORT',
        targetId: id,
        sourceUrl: urlPlan.enqueueSource,
        publishOnReady: requestedPublish ?? existing.isPublished,
      });
      kickMediaWorker({ immediate: true });
    }
    return NextResponse.json({
      short,
      processing: !!urlPlan.enqueueSource || isRawUploadUrl(short.videoUrl),
      videoUrlIgnored: urlPlan.ignoredIncoming,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Этот файл уже сохранён — обновите страницу' },
        { status: 409 },
      );
    }
    console.error('Error updating short:', error);
    return NextResponse.json({ 
      error: 'Failed to update short',
    }, { status: 500 });
  }
}

// DELETE - удалить short
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;

    // URL файлов снимаем до удаления записи: если шортс лежит в нашем S3
    // (публичный https бакета), объект надо удалить — иначе мусор копится, а
    // осиротевший публичный файл остаётся доступен навсегда.
    const fileUrls = await prisma.short.findUnique({
      where: { id },
      select: { videoUrl: true, thumbnail: true },
    });

    await prisma.short.delete({
      where: { id },
    });

    if (fileUrls) {
      await deleteS3ObjectsByUrls([fileUrls.videoUrl, fileUrls.thumbnail]);
    }
    // Незавершённая обработка больше не нужна (исходники тоже удаляются).
    await cancelMediaJobsForTarget('SHORT', id);

    return NextResponse.json({ message: 'Short deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting short:', error);
    return NextResponse.json({ 
      error: 'Failed to delete short',
    }, { status: 500 });
  }
}

// PATCH - обновить счетчик просмотров или другие метрики
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.action === 'incrementViews') {
      // Дедуп накрутки: один «просмотр» шортса на зрителя (сессия или IP) в
      // 6 часов. In-memory limiter обнуляется при деплое — для счётчика
      // просмотров это приемлемо. При превышении отвечаем success без
      // инкремента: клиенту не нужно знать/падать.
      const viewerId =
        (await getSessionUserId(request)) ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown';
      const rl = rateLimit(`short-view:${viewerId}:${id}`, 1, 6 * 60 * 60 * 1000);
      if (!rl.ok) {
        return NextResponse.json({ success: true, deduped: true });
      }

      const short = await prisma.short.update({
        where: { id },
        data: {
          viewsCount: {
            increment: 1
          }
        },
      });

      return NextResponse.json({
        success: true,
        viewsCount: short.viewsCount
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error patching short:', error);
    return NextResponse.json({ 
      error: 'Failed to patch short',
    }, { status: 500 });
  }
}
