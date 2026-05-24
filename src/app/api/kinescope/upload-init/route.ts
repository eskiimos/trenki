import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAsync } from '@/lib/admin-session';

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const { title, filesize, filename } = await request.json();

    if (!title || !filesize) {
      return NextResponse.json({ error: 'title and filesize are required' }, { status: 400 });
    }

    const apiKey = process.env.KINESCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'KINESCOPE_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Получаем parent_id из env или из первого проекта
    let parentId = process.env.KINESCOPE_PROJECT_ID;

    if (!parentId) {
      const projectsRes = await fetch('https://api.kinescope.io/v1/projects?per_page=1', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!projectsRes.ok) {
        const text = await projectsRes.text();
        return NextResponse.json(
          { error: 'Failed to fetch Kinescope projects', details: text },
          { status: 502 }
        );
      }
      const projectsData = await projectsRes.json();
      parentId = projectsData?.data?.[0]?.id;
      if (!parentId) {
        return NextResponse.json(
          { error: 'No Kinescope projects found. Set KINESCOPE_PROJECT_ID env var.' },
          { status: 500 }
        );
      }
    }

    // Инициализируем загрузку на Kinescope — получаем endpoint
    const initRes = await fetch('https://uploader.kinescope.io/v2/init', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'video',
        title,
        parent_id: parentId,
        filesize,
        filename: filename || title,
      }),
    });

    if (!initRes.ok) {
      const text = await initRes.text();
      return NextResponse.json(
        { error: `Kinescope upload init error: ${initRes.status}`, details: text },
        { status: 502 }
      );
    }

    const initData = await initRes.json();
    const videoId: string = initData?.data?.id;
    const uploadUrl: string = initData?.data?.endpoint;

    if (!videoId || !uploadUrl) {
      return NextResponse.json(
        { error: 'Unexpected Kinescope response', details: JSON.stringify(initData) },
        { status: 502 }
      );
    }

    return NextResponse.json({ videoId, uploadUrl });
  } catch (error) {
    console.error('upload-init error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
