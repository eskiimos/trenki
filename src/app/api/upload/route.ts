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
    console.log('=== Thumbnail upload started ===');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', file ? file.name : 'no file');

    if (!file) {
      console.error('No file in formData');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
    }

    console.log('File type:', file.type);
    console.log('File size:', file.size);

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
          folder: 'trenki/thumbnails',
          resource_type: 'image',
          transformation: [
            { width: 1280, height: 720, crop: 'fill' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    console.log('Cloudinary upload successful:', uploadResponse.secure_url);
    console.log('=== Thumbnail upload completed ===');

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
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
