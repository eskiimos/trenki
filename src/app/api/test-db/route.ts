import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('=== DATABASE TEST START ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
    
    // Пробуем подключиться к базе данных
    try {
      await prisma.$connect();
      console.log('Database connection: SUCCESS');
    } catch (dbError: any) {
      console.error('Database connection: FAILED', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: dbError?.message
      }, { status: 500 });
    }
    
    // Пробуем выполнить простой запрос
    try {
      const userCount = await prisma.user.count();
      console.log('User count query: SUCCESS, count =', userCount);
      
      return NextResponse.json({
        success: true,
        message: 'Database connection and queries working',
        userCount,
        environment: process.env.NODE_ENV,
        databaseUrlExists: !!process.env.DATABASE_URL
      });
    } catch (queryError: any) {
      console.error('Database query: FAILED', queryError);
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: queryError?.message
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('=== DATABASE TEST ERROR ===', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error?.message
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}