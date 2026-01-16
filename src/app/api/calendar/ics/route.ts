import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * API для генерации .ICS файла (iCalendar формат)
 * Позволяет добавить тренировку в календарь устройства (iOS/Android)
 */
export async function POST(req: NextRequest) {
  try {
    const { videoId, date } = await req.json();

    if (!videoId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: videoId and date' },
        { status: 400 }
      );
    }

    // Получаем данные видео и тренера из БД
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        title: true,
        duration: true,
        trainer: {
          select: {
            name: true,
            lastName: true,
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const videoTitle = video.title;
    const trainerName = `${video.trainer.name} ${video.trainer.lastName}`;
    const duration = video.duration; // duration в секундах

    // Парсим дату напрямую из строки, без создания Date объекта
    // Строка формата: "2026-01-19T09:00:00.000"
    const dateStr = date as string;
    const dateParts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    
    if (!dateParts) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    const [_, year, month, day, hours, minutes, seconds] = dateParts;
    
    // Вычисляем время окончания
    const startMinutes = parseInt(hours) * 60 + parseInt(minutes);
    const durationMinutes = Math.round(duration / 60);
    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;

    // Форматируем для iCalendar без использования Date
    const formatICSDateTime = (y: string, m: string, d: string, h: number, min: number) => {
      return `${y}${m}${d}T${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
    };

    const startDateTime = formatICSDateTime(year, month, day, parseInt(hours), parseInt(minutes));
    const endDateTime = formatICSDateTime(year, month, day, endHours, endMins);

    // Экранируем специальные символы для iCalendar
    const escapeICS = (str: string): string => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_APP_URL || 'https://trenki.app';
    const uid = `workout-${videoId}-${Date.now()}@trenki.app`;
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Генерируем содержимое .ICS файла
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Trenki//Workout Calendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE-TIME:${startDateTime}`,
      `DTEND;VALUE=DATE-TIME:${endDateTime}`,
      `SUMMARY:🏋️ ${escapeICS(videoTitle)}`,
      `DESCRIPTION:Тренировка с ${escapeICS(trainerName || 'тренером')}\\nДлительность: ${Math.round(duration / 60)} мин\\n\\nОткрыть в приложении: ${appUrl}/video/${videoId}`,
      'LOCATION:Онлайн',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      // Напоминание за 30 минут
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Через 30 минут начнётся тренировка!',
      'END:VALARM',
      // Напоминание за 10 минут
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Через 10 минут начнётся тренировка!',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Возвращаем файл
    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="trenki-workout-${videoId}-${Date.now()}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating ICS file:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}
