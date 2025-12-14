#!/bin/bash

# Скрипт проверки готовности к развертыванию
# Проверяет наличие всех необходимых файлов и конфигураций

echo "🔍 Проверка готовности Trenki к развертыванию..."
echo ""

ERRORS=0
WARNINGS=0

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для проверки файла
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 - НЕ НАЙДЕН"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Функция для проверки директории
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/ - НЕ НАЙДЕНА"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Функция для предупреждения
check_optional() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 - не найден (опционально)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

echo "📦 Проверка основных файлов проекта:"
check_file "package.json"
check_file "next.config.ts"
check_file "tsconfig.json"
check_file "tailwind.config.ts"
check_dir "src"
check_dir "public"
check_dir "prisma"

echo ""
echo "🐳 Проверка Docker файлов:"
check_file "Dockerfile"
check_file "Dockerfile.bot"
check_file "docker-compose.yml"
check_file ".dockerignore"

echo ""
echo "🚀 Проверка скриптов развертывания:"
check_dir "deploy"
check_file "deploy/deploy-docker.sh"
check_file "deploy/deploy-pm2.sh"
check_file "deploy/deploy-systemd.sh"
check_file "deploy/update.sh"
check_file "deploy/nginx.conf"

# Проверка прав на выполнение
if [ -x "deploy/deploy-docker.sh" ]; then
    echo -e "${GREEN}✓${NC} deploy-docker.sh - исполняемый"
else
    echo -e "${YELLOW}⚠${NC} deploy-docker.sh - не исполняемый (запустите: chmod +x deploy/*.sh)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "⚙️ Проверка конфигурационных файлов:"
check_file "ecosystem.config.js"
check_dir "systemd"
check_file "systemd/trenki-web.service"
check_file "systemd/trenki-bot.service"

echo ""
echo "📖 Проверка документации:"
check_file "DEPLOYMENT_GUIDE.md"
check_file "DEPLOYMENT_QUICK_START.md"
check_file "DEPLOYMENT_README.md"
check_file "SECURITY_PRODUCTION.md"
check_file ".env.example"

echo ""
echo "🔐 Проверка переменных окружения:"
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC} .env файл найден"
    echo "   Убедитесь, что он содержит:"
    
    # Проверка необходимых переменных
    required_vars=("DATABASE_URL" "KINESCOPE_API_KEY" "BOT_TOKEN" "NEXT_PUBLIC_BOT_USERNAME" "NEXT_PUBLIC_APP_URL")
    
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" .env; then
            if grep "^$var=.*your.*\|^$var=.*YOUR.*\|^$var=$" .env > /dev/null; then
                echo -e "   ${YELLOW}⚠${NC} $var - не заполнен"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "   ${GREEN}✓${NC} $var"
            fi
        else
            echo -e "   ${RED}✗${NC} $var - отсутствует"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${YELLOW}⚠${NC} .env файл не найден"
    echo "   Создайте его: cp .env.example .env"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🤖 Проверка Telegram бота:"
check_dir "telegram-bot"
if [ -f "telegram-bot/package.json" ]; then
    echo -e "${GREEN}✓${NC} telegram-bot/package.json"
else
    echo -e "${RED}✗${NC} telegram-bot/package.json - НЕ НАЙДЕН"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📊 Проверка Next.js конфигурации:"
if grep -q "output.*standalone" next.config.ts; then
    echo -e "${GREEN}✓${NC} Standalone режим включен в next.config.ts"
else
    echo -e "${RED}✗${NC} Standalone режим НЕ включен в next.config.ts"
    echo "   Добавьте: output: 'standalone'"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "🔍 Проверка зависимостей:"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules установлены"
else
    echo -e "${YELLOW}⚠${NC} node_modules не установлены"
    echo "   Запустите: npm install"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d ".next" ]; then
    echo -e "${GREEN}✓${NC} Next.js собран (.next/)"
else
    echo -e "${YELLOW}⚠${NC} Next.js не собран"
    echo "   Запустите: npm run build"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Все проверки пройдены! Готово к развертыванию.${NC}"
    echo ""
    echo "Следующие шаги:"
    echo "  1. Заполните .env файл"
    echo "  2. Загрузите код на сервер"
    echo "  3. Запустите: ./deploy/deploy-docker.sh (или другой метод)"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Проверка завершена с предупреждениями: $WARNINGS${NC}"
    echo ""
    echo "Можно продолжать, но рекомендуется исправить предупреждения."
    exit 0
else
    echo -e "${RED}❌ Проверка не пройдена! Найдено ошибок: $ERRORS, предупреждений: $WARNINGS${NC}"
    echo ""
    echo "Исправьте ошибки перед развертыванием."
    exit 1
fi
