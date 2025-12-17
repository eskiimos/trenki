# Dockerfile для Next.js приложения
FROM node:20-alpine AS base

# Установка зависимостей
FROM base AS deps
WORKDIR /app

# Копирование файлов зависимостей и prisma схемы (нужна для postinstall)
COPY package*.json ./
COPY prisma ./prisma/
    RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps || npm install --legacy-peer-deps
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Отключение телеметрии Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Билд Next.js (включает generate:icons и prisma generate через postinstall)
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
