import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdminAsync } from '@/lib/admin-session';

// Конфигурация Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    // kind=short — обложка шортса: вертикальная 9:16. По умолчанию (видео
    // каталога) — 16:9. Правка владельца «Начало сентября»: раньше ВСЁ резалось
    // в 1280×720, а шортсы везде показываются 9:16 — от вертикальной картинки
    // оставалась узкая полоска по центру, и обложка «не подбиралась».
    const kind = formData.get('kind') === 'short' ? 'short' : 'video';


    if (!file) {
      console.error('No file in formData');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
    }


    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must not exceed 5MB' }, { status: 400 });
    }

    // Конвертируем файл в buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Загружаем в Cloudinary
    const uploadResponse = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: kind === 'short' ? 'trenki/thumbnails/shorts' : 'trenki/thumbnails',
          resource_type: 'image',
          transformation: [
            kind === 'short'
              ? { width: 1080, height: 1920, crop: 'fill' }
              : { width: 1280, height: 720, crop: 'fill' },
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });


    return NextResponse.json({ 
      success: true, 
      path: uploadResponse.secure_url,
      url: uploadResponse.secure_url,
      message: 'Thumbnail uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    return NextResponse.json({ 
      error: 'Failed to upload thumbnail',
    }, { status: 500 });
  }
}
