-- CreateTable для login_tokens
CREATE TABLE IF NOT EXISTS login_tokens (
  token TEXT PRIMARY KEY,
  telegram_id TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_login_tokens_telegram_id ON login_tokens(telegram_id);

-- Индекс для автоматической очистки истёкших токенов
CREATE INDEX IF NOT EXISTS idx_login_tokens_expires_at ON login_tokens(expires_at);
