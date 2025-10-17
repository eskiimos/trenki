import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, getWelcomeEmailTemplate, getNewVideoEmailTemplate } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, to, data } = body;

    console.log('📧 Email request:', { type, to });

    let html = '';
    let subject = '';

    switch (type) {
      case 'welcome':
        subject = 'Добро пожаловать в Треньки! 🏒';
        html = getWelcomeEmailTemplate(data.name || 'друг');
        break;

      case 'new-video':
        subject = `Новое видео: ${data.videoTitle}`;
        html = getNewVideoEmailTemplate(data.videoTitle, data.videoUrl);
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown email type' },
          { status: 400 }
        );
    }

    const result = await sendEmail({
      to,
      subject,
      html,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        data: result.data,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in send-email API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
