-- Push «доступно новое видео»: отметка времени рассылки push атлетам по видео.
-- null = ещё не уведомляли; защищает от повторной рассылки при редактировании.
-- Аддитивно (nullable), бэкфилл не нужен.
ALTER TABLE "videos" ADD COLUMN "athletesNotifiedAt" TIMESTAMP(3);
