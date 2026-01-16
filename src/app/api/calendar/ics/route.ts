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

    const startDate = new Date(date);
    const endDate = new Date(startDate.getTime() + duration * 1000); // duration в секундах, умножаем на 1000 для миллисекунд

    // Форматируем даты в формате iCalendar (YYYYMMDDTHHMMSS)
    // Используем обычные методы (не UTC), чтобы читать время как есть из БД
    const formatICSDate = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    // Экранируем специальные символы для iCalendar
    const escapeICS = (str: string): string => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEB_APP_URL || 'https://trenki.app';
    const uid = `workout-${videoId}-${startDate.getTime()}@trenki.app`;

    // Генерируем содержимое .ICS файла
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Trenki//Workout Calendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART;VALUE=DATE-TIME:${formatICSDate(startDate)}`,
      `DTEND;VALUE=DATE-TIME:${formatICSDate(endDate)}`,
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
