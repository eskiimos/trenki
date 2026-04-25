import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Test route to check single video
async function testGetVideo() {
  try {
    const video = await prisma.video.findFirst({
      where: { isPublished: true },
      include: {
        trainer: {
          select: {
            id: true,
            name: true,
            lastName: true,
            avatar: true,
            speciality: true,
          },
        },
        videoTags: {
          include: {
            tag: true
          }
        },
        _count: {
          select: {
            likes: true,
          }
        }
      },
    });

    if (!video) {
      console.log('No video found');
      return;
    }

    const loadTypesFromTags = video.videoTags
      .filter(vt => vt.tag.tagType === 'LOAD' && vt.tag.loadType)
      .map(vt => vt.tag.loadType);

    const loadTypes = loadTypesFromTags.length > 0 
      ? loadTypesFromTags 
      : (video.loadType ? [video.loadType] : []);

    const result = {
      id: video.id,
      title: video.title,
      difficulty: video.difficulty,
      moduleType: video.moduleType,
      loadType: video.loadType,
      muscleGroup: video.muscleGroup,
      rpeMin: video.rpeMin,
      rpeMax: video.rpeMax,
      loadTypes,
    };

    console.log('\n✅ API Response for video:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGetVideo();
