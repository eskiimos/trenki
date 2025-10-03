import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Проверяем тип файла (только изображения)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Путь к папке public/avatars
    const uploadDir = path.join(process.cwd(), 'public', 'avatars');
    
    // Создаем папку если её нет
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    // Сохраняем файл
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Возвращаем путь к файлу (относительно public)
    const publicPath = `/avatars/${filename}`;

    return NextResponse.json({ 
      success: true, 
      url: publicPath,
      message: 'Avatar uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
