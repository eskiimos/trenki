import { NextRequest, NextResponse } from 'next/server';
import { gatePaidContent } from '@/lib/coach/guards';
import { getFreeLessonVideoId } from '@/lib/settings';
import { prisma } from '@/lib/prisma';

// In-memory кэш метаданных Kinescope.
// Kinescope CDN ссылки на assets обычно не меняются для одного видео,
// поэтому кэшируем результат на 30 минут — это убирает повторные походы
// в Kinescope API при заходе на одну и ту же страницу /video/[id].
type CachedMetadata = {
  data: any;
  expiresAt: number;
};
const metadataCache = new Map<string, CachedMetadata>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 минут

// Дедупликация одновременных запросов: если один и тот же videoId
// запрашивается параллельно, ждём один и тот же промис.
const inflight = new Map<string, Promise<any>>();

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    // Резолв реального URL воспроизведения — платный чокпоинт (defense-in-depth к
    // videos/[id]). Но этот роут резолвит ЛЮБОЙ kinescope-контент, в том числе
    // БЕСПЛАТНЫЙ: шортсы и «занятие недели». Гейтим только платные видео-занятия,
    // иначе при включённом paywall ломаются шортсы (они бесплатны по продукту).
    const [freeLessonId, short] = await Promise.all([
      getFreeLessonVideoId(),
      prisma.short.findFirst({ where: { videoUrl }, select: { id: true } }),
    ]);

    let isFreeLesson = false;
    if (freeLessonId) {
      const free = await prisma.video.findUnique({
        where: { id: freeLessonId },
        select: { videoUrl: true },
      });
      isFreeLesson = !!free && free.videoUrl === videoUrl;
    }

    if (!short && !isFreeLesson) {
      const blocked = await gatePaidContent(request);
      if (blocked) return blocked;
    }

    // Извлекаем ID видео из URL Kinescope
    // Поддерживаемые форматы:
    // - https://kinescope.io/{videoId} (просто UUID видео)
    // - https://kinescope.io/{projectId}/{videoId} (первый UUID - это ID видео!)
    // - {videoId} (просто ID)
    let videoId = '';
    
    if (videoUrl.includes('kinescope.io')) {
      const urlParts = videoUrl.replace('https://', '').replace('http://', '').split('/').filter(Boolean);
      // В URL вида kinescope.io/mFrWREAhz2iy2557cG9Fa1/plAE11wa
      // первый ID после kinescope.io - это ID видео (mFrWREAhz2iy2557cG9Fa1)
      // второй ID - это slug для SEO (plAE11wa)
      videoId = urlParts[1]; // берём первый ID после домена
    } else {
      videoId = videoUrl.trim();
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Invalid Kinescope URL or Video ID' }, { status: 400 });
    }

    // Проверяем кэш
    const cached = metadataCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'public, max-age=300, s-maxage=1800',
        },
      });
    }

    // Проверяем inflight (дедупликация параллельных запросов)
    const existing = inflight.get(videoId);
    if (existing) {
      const data = await existing;
      return NextResponse.json(data, { headers: { 'X-Cache': 'INFLIGHT' } });
    }

    // Получаем API ключ из переменных окружения
    const apiKey = process.env.KINESCOPE_API_KEY;

    if (!apiKey) {
      console.warn('KINESCOPE_API_KEY not found in environment variables');
      return NextResponse.json({ 
        error: 'Kinescope API key not configured',
        message: 'Please add KINESCOPE_API_KEY to your .env.local file'
      }, { status: 400 });
    }

    // Создаём промис запроса и кладём в inflight
    const fetchPromise = (async () => {
      const apiUrl = `https://api.kinescope.io/v1/videos/${videoId}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err: any = new Error(`Kinescope API error: ${response.status}`);
        err.status = response.status;
        err.details = errorText;
        throw err;
      }

      const data = await response.json();

      // Извлекаем данные из ответа
      const videoData = data.data || data;
      const duration = Math.round(videoData.duration || 0);
      const thumbnail = videoData.poster?.original || videoData.poster?.md || videoData.poster?.sm || '';
      const title = videoData.title || videoData.name || '';
      const description = videoData.description || videoData.subtitle || '';

      // Извлекаем прямые ссылки на видео в разных качествах
      const assets = videoData.assets || [];
      const videoQualities: Record<string, string> = {};
      const qualityOrder = ['480p', '720p', '360p', '1080p', 'original'];
      
      assets.forEach((asset: any) => {
        if (asset.filetype === 'mp4' && asset.url) {
          const quality = asset.quality || 'unknown';
          videoQualities[quality] = asset.url;
        }
      });

      let directVideoUrl = '';
      for (const quality of qualityOrder) {
        if (videoQualities[quality]) {
          directVideoUrl = videoQualities[quality];
          break;
        }
      }

      if (!directVideoUrl && videoData.hls_link) {
        directVideoUrl = videoData.hls_link;
      }

      const result = {
        success: true,
        duration,
        thumbnail,
        title,
        description,
        videoId,
        directVideoUrl,
        availableQualities: videoQualities,
        hlsUrl: videoData.hls_link,
      };

      // Сохраняем в кэш
      metadataCache.set(videoId, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return result;
    })();

    inflight.set(videoId, fetchPromise);
    
    try {
      const data = await fetchPromise;
      return NextResponse.json(data, {
        headers: {
          'X-Cache': 'MISS',
          'Cache-Control': 'public, max-age=300, s-maxage=1800',
        },
      });
    } catch (err: any) {
      if (err.status) {
        return NextResponse.json(
          {
            error: `Kinescope API error: ${err.status}`,
            details: err.details,
            message: 'Проверьте правильность URL видео и API ключа',
          },
          { status: err.status }
        );
      }
      throw err;
    } finally {
      inflight.delete(videoId);
    }
  } catch (error: any) {
    console.error('Error fetching Kinescope metadata:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch video metadata',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
