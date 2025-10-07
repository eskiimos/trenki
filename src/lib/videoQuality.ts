/**
 * Утилиты для работы с качеством видео
 */

export interface VideoQuality {
  quality: string;
  url: string;
  height: number;
}

/**
 * Определяет оптимальное качество видео на основе скорости соединения
 * @returns качество видео ('1080p', '720p', '480p', '360p')
 */
export function getOptimalQuality(): string {
  // Проверяем API Network Information (поддерживается не везде)
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    const effectiveType = connection?.effectiveType;

    // effectiveType: 'slow-2g', '2g', '3g', '4g'
    switch (effectiveType) {
      case '4g':
        return '1080p';
      case '3g':
        return '720p';
      case '2g':
        return '480p';
      case 'slow-2g':
        return '360p';
    }

    // Проверяем downlink (скорость в Mbps)
    const downlink = connection?.downlink;
    if (downlink) {
      if (downlink >= 10) return '1080p';
      if (downlink >= 5) return '720p';
      if (downlink >= 2) return '480p';
      return '360p';
    }
  }

  // Определяем по типу устройства
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const screenWidth = window.innerWidth;

  if (isMobile) {
    // На мобильных выбираем среднее качество
    return screenWidth > 1080 ? '1080p' : '720p';
  } else {
    // На десктопе высокое качество
    return screenWidth > 1920 ? '1080p' : '720p';
  }
}

/**
 * Выбирает лучшее доступное качество из списка
 * @param availableQualities - объект с доступными качествами
 * @param preferredQuality - предпочитаемое качество
 * @returns URL видео
 */
export function selectBestQuality(
  availableQualities: Record<string, string>,
  preferredQuality?: string
): string {
  const qualityOrder = ['1080p', '720p', '480p', '360p', 'original'];
  
  // Если указано предпочитаемое качество и оно доступно
  if (preferredQuality && availableQualities[preferredQuality]) {
    return availableQualities[preferredQuality];
  }

  // Иначе берём лучшее доступное
  for (const quality of qualityOrder) {
    if (availableQualities[quality]) {
      return availableQualities[quality];
    }
  }

  // Если ничего не нашли, возвращаем первое доступное
  return Object.values(availableQualities)[0] || '';
}

/**
 * Конвертирует Kinescope URL в прямую ссылку через API
 * @param videoUrl - URL видео Kinescope
 * @returns объект с метаданными и прямой ссылкой
 */
export async function getKinescopeDirectUrl(videoUrl: string): Promise<{
  directUrl: string;
  availableQualities: Record<string, string>;
  thumbnail: string;
  duration: number;
  title: string;
  description: string;
}> {
  try {
    const response = await fetch('/api/kinescope/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Kinescope metadata');
    }

    const data = await response.json();

    // Выбираем оптимальное качество
    const optimalQuality = getOptimalQuality();
    const directUrl = selectBestQuality(data.availableQualities, optimalQuality);

    return {
      directUrl: directUrl || data.directVideoUrl || data.hlsUrl,
      availableQualities: data.availableQualities || {},
      thumbnail: data.thumbnail || '',
      duration: data.duration || 0,
      title: data.title || '',
      description: data.description || '',
    };
  } catch (error) {
    console.error('Error getting Kinescope direct URL:', error);
    throw error;
  }
}

/**
 * Проверяет, является ли URL ссылкой на Kinescope
 */
export function isKinescopeUrl(url: string): boolean {
  return url?.includes('kinescope.io') || false;
}
