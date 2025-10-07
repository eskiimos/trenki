import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
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

    console.log('Fetching metadata for video ID:', videoId);

    // Получаем API ключ из переменных окружения
    const apiKey = process.env.KINESCOPE_API_KEY;

    if (!apiKey) {
      console.warn('KINESCOPE_API_KEY not found in environment variables');
      return NextResponse.json({ 
        error: 'Kinescope API key not configured',
        message: 'Please add KINESCOPE_API_KEY to your .env.local file'
      }, { status: 400 });
    }

    // Запрос к Kinescope API
    const apiUrl = `https://api.kinescope.io/v1/videos/${videoId}`;
    console.log('Requesting:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Kinescope API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kinescope API error response:', errorText);
      
      return NextResponse.json({ 
        error: `Kinescope API error: ${response.status}`,
        details: errorText,
        message: 'Проверьте правильность URL видео и API ключа'
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('Kinescope API response data:', JSON.stringify(data, null, 2));

    // Извлекаем данные из ответа
    const videoData = data.data || data;
    const duration = Math.round(videoData.duration || 0);
    // Берём превью: original (высокое качество), md (среднее) или sm (маленькое)
    const thumbnail = videoData.poster?.original || videoData.poster?.md || videoData.poster?.sm || '';
    const title = videoData.title || videoData.name || '';
    const description = videoData.description || videoData.subtitle || '';

    // Извлекаем прямые ссылки на видео в разных качествах
    const assets = videoData.assets || [];
    const videoQualities: Record<string, string> = {};
    
    // Сортируем по качеству (от лучшего к худшему)
    const qualityOrder = ['1080p', '720p', '480p', '360p', 'original'];
    
    assets.forEach((asset: any) => {
      if (asset.filetype === 'mp4' && asset.url) {
        const quality = asset.quality || 'unknown';
        videoQualities[quality] = asset.url;
      }
    });

    // Выбираем оптимальное качество (720p по умолчанию, или лучшее доступное)
    let directVideoUrl = '';
    for (const quality of qualityOrder) {
      if (videoQualities[quality]) {
        directVideoUrl = videoQualities[quality];
        break;
      }
    }

    // Если не нашли MP4, используем HLS ссылку
    if (!directVideoUrl && videoData.hls_link) {
      directVideoUrl = videoData.hls_link;
    }

    console.log('Extracted data:', { 
      duration, 
      thumbnail, 
      title, 
      description,
      availableQualities: Object.keys(videoQualities),
      directVideoUrl: directVideoUrl ? 'found' : 'not found'
    });

    return NextResponse.json({ 
      success: true,
      duration,
      thumbnail,
      title,
      description,
      videoId,
      directVideoUrl, // Прямая ссылка на видео
      availableQualities: videoQualities, // Все доступные качества
      hlsUrl: videoData.hls_link, // HLS ссылка для adaptive streaming
    });
  } catch (error: any) {
    console.error('Error fetching Kinescope metadata:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch video metadata',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
