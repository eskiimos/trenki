import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN!;

// Проверка подписи от Telegram (обязательно для безопасности!)
function verifyTelegramAuth(authData: any): boolean {
  const checkString = Object.keys(authData)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${authData[key]}`)
    .join('\n');

  const secretKey = crypto
    .createHash('sha256')
    .update(BOT_TOKEN)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return hash === authData.hash;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Получаем данные от Telegram
    const authData: any = {
      id: searchParams.get('id'),
      first_name: searchParams.get('first_name'),
      last_name: searchParams.get('last_name'),
      username: searchParams.get('username'),
      photo_url: searchParams.get('photo_url'),
      auth_date: searchParams.get('auth_date'),
      hash: searchParams.get('hash')
    };

    // Удаляем null значения
    Object.keys(authData).forEach(key => {
      if (authData[key] === null) delete authData[key];
    });

    console.log('📥 Telegram auth data received:', authData);

    // Проверяем подпись (ВАЖНО для безопасности!)
    if (!verifyTelegramAuth(authData)) {
      console.error('❌ Invalid Telegram auth signature!');
      return NextResponse.redirect(
        new URL('/login-simple?error=invalid_signature', request.url)
      );
    }

    // Проверяем, что данные не старше 24 часов
    const authDate = parseInt(authData.auth_date);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.error('❌ Auth data too old');
      return NextResponse.redirect(
        new URL('/login-simple?error=expired', request.url)
      );
    }

    console.log('✅ Telegram auth verified!');

    // Сохраняем пользователя в БД или проверяем существование
    // TODO: Здесь можно добавить логику с Prisma
    
    // Создаём HTML страницу, которая отправит данные в parent window
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization successful</title>
  <script>
    window.opener.postMessage({
      type: 'telegram-auth-success',
      user: ${JSON.stringify(authData)}
    }, '*');
    
    // Сохраняем данные в localStorage
    localStorage.setItem('telegram_user', JSON.stringify(${JSON.stringify(authData)}));
    localStorage.setItem('auth_timestamp', Date.now().toString());
    
    // Закрываем окно через 1 секунду
    setTimeout(() => {
      window.close();
      // Если окно не закрылось, перенаправляем
      if (!window.closed) {
        window.location.href = '/';
      }
    }, 1000);
  </script>
</head>
<body style="font-family: system-ui; text-align: center; padding: 40px;">
  <h1>✅ Авторизация успешна!</h1>
  <p>Окно закроется автоматически...</p>
  <p><a href="/">Если окно не закрылось, нажмите сюда</a></p>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('❌ Error in telegram callback:', error);
    return NextResponse.redirect(
      new URL('/login-simple?error=server_error', request.url)
    );
  }
}
