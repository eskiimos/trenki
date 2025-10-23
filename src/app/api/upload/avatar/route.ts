import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    console.log('=== Avatar upload started ===');
    const formData = await request.formData();
    const file = formData.get('file') as File;

    console.log('File received:', file ? file.name : 'no file');

    if (!file) {
      console.error('No file in formData');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Проверяем тип файла (только изображения)
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    console.log('File type:', file.type);
    console.log('File size:', file.size);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Создаем уникальное имя файла
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    console.log('Generated filename:', filename);
    
    // Путь к папке public/avatars
    const uploadDir = path.join(process.cwd(), 'public', 'avatars');
    
    console.log('Upload directory:', uploadDir);
    
    // Создаем папку если её нет
    if (!existsSync(uploadDir)) {
      console.log('Creating upload directory...');
      mkdirSync(uploadDir, { recursive: true });
    }

    // Сохраняем файл
    const filepath = path.join(uploadDir, filename);
    console.log('Saving to:', filepath);
    
    await writeFile(filepath, buffer);
    
    console.log('File saved successfully');

    // Возвращаем путь к файлу (относительно public)
    const publicPath = `/avatars/${filename}`;

    console.log('Public path:', publicPath);
    console.log('=== Avatar upload completed ===');

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
