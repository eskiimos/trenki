import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

// Храним коды верификации в памяти (в продакшене лучше использовать Redis)
const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

// Генерируем 4-значный код
function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Шаблон письма с кодом
function getVerificationEmailTemplate(code: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Код подтверждения</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #A1FF4A; font-size: 48px; margin: 0; font-weight: bold;">ТРЕНЬКИ</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h2 style="color: #101530; font-size: 24px; margin: 0 0 20px 0;">
                Код подтверждения
              </h2>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Введите этот код для подтверждения вашего email:
              </p>
              
              <div style="background-color: #f8f8f8; border: 2px solid #A1FF4A; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                <div style="font-size: 48px; font-weight: bold; color: #101530; letter-spacing: 10px;">
                  ${code}
                </div>
              </div>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                Код действителен в течение 10 минут.<br>
                Если вы не запрашивали этот код, просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © 2025 Треньки. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// POST - отправка кода
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      );
    }

    console.log('📧 Sending verification code to:', email);

    // Генерируем код
    const code = generateCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 минут

    // Сохраняем код
    verificationCodes.set(email.toLowerCase(), { code, expiresAt });

    // Отправляем email
    const result = await sendEmail({
      to: email,
      subject: 'Код подтверждения Треньки',
      html: getVerificationEmailTemplate(code),
    });

    if (result.success) {
      console.log('✅ Verification code sent successfully');
      return NextResponse.json({
        success: true,
        message: 'Код отправлен на email',
      });
    } else {
      console.error('❌ Failed to send email:', result.error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in verify-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - проверка кода
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const email = searchParams.get('email');
    const code = searchParams.get('code');

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Verifying code for:', email);

    const stored = verificationCodes.get(email.toLowerCase());

    if (!stored) {
      return NextResponse.json(
        { error: 'Code not found or expired' },
        { status: 400 }
      );
    }

    // Проверяем срок действия
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email.toLowerCase());
      return NextResponse.json(
        { error: 'Code expired' },
        { status: 400 }
      );
    }

    // Проверяем код
    if (stored.code !== code) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 400 }
      );
    }

    // Код верный - удаляем из хранилища
    verificationCodes.delete(email.toLowerCase());

    console.log('✅ Email verified successfully');

    return NextResponse.json({
      success: true,
      message: 'Email verified',
    });
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
