#!/bin/bash

# Скрипт для проверки конфигурации Telegram бота

echo "🔍 Проверка конфигурации Telegram бота..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Проверка webhook
echo "1️⃣  Проверка webhook..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot8124848980:AAFEzFLBJhE9dOyDoxzKA7Zse4T_Hr4q9xU/getWebhookInfo")
WEBHOOK_URL=$(echo "$WEBHOOK_INFO" | jq -r '.result.url')

if [ "$WEBHOOK_URL" == "https://trenki.vercel.app/api/telegram" ]; then
    echo -e "${GREEN}✅ Webhook настроен правильно: $WEBHOOK_URL${NC}"
else
    echo -e "${RED}❌ Webhook неправильный: $WEBHOOK_URL${NC}"
    echo -e "${YELLOW}   Ожидается: https://trenki.vercel.app/api/telegram${NC}"
fi
echo ""

# 2. Проверка информации о боте
echo "2️⃣  Проверка информации о боте..."
BOT_INFO=$(curl -s "https://api.telegram.org/bot8124848980:AAFEzFLBJhE9dOyDoxzKA7Zse4T_Hr4q9xU/getMe")
BOT_USERNAME=$(echo "$BOT_INFO" | jq -r '.result.username')

if [ "$BOT_USERNAME" == "trenkibot" ]; then
    echo -e "${GREEN}✅ Имя бота: @$BOT_USERNAME${NC}"
else
    echo -e "${RED}❌ Неожиданное имя бота: @$BOT_USERNAME${NC}"
fi
echo ""

# 3. Проверка доступности production endpoint
echo "3️⃣  Проверка доступности production endpoint..."
PROD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://trenki.vercel.app/login")

if [ "$PROD_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Production страница /login доступна (HTTP $PROD_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  Production страница /login: HTTP $PROD_STATUS${NC}"
fi
echo ""

# 4. Проверка API endpoint
echo "4️⃣  Проверка API endpoint..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://trenki.vercel.app/api/auth/telegram")

if [ "$API_STATUS" == "405" ] || [ "$API_STATUS" == "401" ]; then
    echo -e "${GREEN}✅ API endpoint доступен (HTTP $API_STATUS - ожидаемо для GET запроса)${NC}"
else
    echo -e "${YELLOW}⚠️  API endpoint: HTTP $API_STATUS${NC}"
fi
echo ""

# 5. Проверка переменных окружения в .env.local
echo "5️⃣  Проверка локальных переменных окружения (.env.local)..."

if [ -f ".env.local" ]; then
    if grep -q "BOT_TOKEN" .env.local; then
        echo -e "${GREEN}✅ BOT_TOKEN найден в .env.local${NC}"
    else
        echo -e "${RED}❌ BOT_TOKEN не найден в .env.local${NC}"
    fi
    
    if grep -q "NEXT_PUBLIC_BOT_USERNAME" .env.local; then
        BOT_USERNAME_ENV=$(grep "NEXT_PUBLIC_BOT_USERNAME" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ "$BOT_USERNAME_ENV" == "trenkibot" ]; then
            echo -e "${GREEN}✅ NEXT_PUBLIC_BOT_USERNAME = $BOT_USERNAME_ENV${NC}"
        else
            echo -e "${YELLOW}⚠️  NEXT_PUBLIC_BOT_USERNAME = $BOT_USERNAME_ENV (ожидается: trenkibot)${NC}"
        fi
    else
        echo -e "${RED}❌ NEXT_PUBLIC_BOT_USERNAME не найден в .env.local${NC}"
    fi
else
    echo -e "${RED}❌ Файл .env.local не найден${NC}"
fi
echo ""

# Итоговая инструкция
echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
echo ""
echo "1. Проверь домен в BotFather:"
echo "   - Открой @BotFather в Telegram"
echo "   - /mybots → @trenkibot → Bot Settings → Domain"
echo "   - Убедись, что там: trenki.vercel.app"
echo ""
echo "2. Проверь переменные в Vercel Dashboard:"
echo "   - Открой https://vercel.com/eskiimos/trenki/settings/environment-variables"
echo "   - Убедись, что установлены:"
echo "     • BOT_TOKEN"
echo "     • NEXT_PUBLIC_BOT_USERNAME"
echo "     • DATABASE_URL"
echo "     • KINESCOPE_API_KEY"
echo ""
echo "3. После настройки:"
echo "   - Очисти кэш браузера (Ctrl+Shift+R)"
echo "   - Открой https://trenki.vercel.app/login"
echo "   - Проверь виджет Telegram Login"
echo ""
