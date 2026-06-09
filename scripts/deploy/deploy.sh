#!/bin/sh
# Auto-deploy скрипт. Запускается host-cron'ом, когда появляется
# /home/trenki/deploy-trigger/trigger (его пишет Next.js endpoint
# /api/webhook/github-deploy при push'е в main).
#
# Шаги: git pull → docker build → prisma migrate deploy → up -d.
# Логи: /var/log/trenki-auto-deploy.log

set -e
cd /home/trenki

LOG=/var/log/trenki-auto-deploy.log
LOCK=/tmp/trenki-deploy.lock

# Предотвращаем параллельные деплои (если webhook прилетит во время билда).
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$(date -u +%FT%TZ)] другой деплой ещё идёт, пропускаю" >> "$LOG"
  exit 0
fi

{
  echo "===== $(date -u +%FT%TZ) start ====="
  echo "--- git pull ---"
  git pull origin main 2>&1

  echo "--- build ---"
  docker compose -f docker-compose.production.yml build app 2>&1 | tail -10

  echo "--- migrate ---"
  set -a
  . ./.env.production
  set +a
  docker run --rm \
    -e DATABASE_URL \
    --network host \
    -v "$(pwd)/prisma:/work/prisma" \
    -w /work \
    node:20-alpine sh -c \
    "npm i --no-save --legacy-peer-deps --silent prisma@6.19.2 @prisma/client@6.19.2 && npx prisma migrate deploy" 2>&1 | tail -15

  echo "--- up -d ---"
  docker compose -f docker-compose.production.yml up -d app 2>&1 | tail -5

  echo "--- health ---"
  sleep 8
  docker ps --filter name=trenki-app --format '{{.Names}} {{.Status}}'
  curl -s -o /dev/null -w 'https=%{http_code}' https://trenki.app/
  echo
  echo "===== $(date -u +%FT%TZ) done ====="
  echo
} >> "$LOG" 2>&1
