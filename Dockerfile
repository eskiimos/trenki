# Dockerfile для Next.js приложения
FROM node:20-alpine AS base

# Установка зависимостей
FROM base AS deps
WORKDIR /app

# Копирование файлов зависимостей и prisma схемы (нужна для postinstall)
COPY package*.json ./
COPY prisma ./prisma/

# Установка curl для скачивания
RUN apk add --no-cache curl

# Установка с отключением Prisma postinstall (скачаем engines вручную)
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN npm install --legacy-peer-deps --ignore-scripts

# Вручную скачиваем и генерируем Prisma
RUN npx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Отключение телеметрии Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Генерация Prisma клиента (создает src/generated/prisma)
RUN npx prisma generate

# Билд Next.js
RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копирование public файлов
COPY --from=builder /app/public ./public

# Установка правильных прав для prerender кеша
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Копирование собранных файлов
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
