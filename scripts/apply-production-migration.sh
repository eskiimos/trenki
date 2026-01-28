#!/bin/bash
# Применяет миграции к production базе

set -e

echo "🔄 Applying migrations to production database..."

# Загружаем production DATABASE_URL
export $(grep DATABASE_URL .env.production | xargs)

# Применяем миграции
npx prisma migrate deploy

echo "✅ Migrations applied successfully!"
