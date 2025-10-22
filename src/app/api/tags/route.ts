import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagType = searchParams.get('type'); // load, muscle, complexity, goal

    const where = tagType ? { tagType: tagType.toUpperCase() as any } : {};

    const tags = await prisma.tag.findMany({
      where,
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
