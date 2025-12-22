# 🔒 Безопасность: Работа с секретами

## ⚠️ ВАЖНО: Секреты никогда не должны попадать в git!

### ✅ Что защищено:

- `.env*` файлы добавлены в `.gitignore`
- Токены и API ключи хранятся только в переменных окружения
- Production секреты хранятся в Vercel Environment Variables

### 🔐 Секреты проекта:

1. **BOT_TOKEN** - Токен Telegram бота (@BotFather)
2. **RESEND_API_KEY** - API ключ Resend для email
3. **DATABASE_URL** - PostgreSQL connection string (Prisma Accelerate)
4. **DIRECT_URL** - PostgreSQL direct connection string

### 📝 Как работать с секретами:

#### Локально:
```bash
# Создайте .env.local (он в .gitignore)
cp .env.example .env.local

# Добавьте реальные значения
BOT_TOKEN="your_bot_token_here"
RESEND_API_KEY="your_resend_key_here"
DATABASE_URL="your_database_url_here"
DIRECT_URL="your_direct_url_here"
```

#### На Vercel:
1. Зайдите в Settings → Environment Variables
2. Добавьте каждый секрет отдельно
3. Выберите окружение (Production, Preview, Development)

### 🚨 Если секрет утек:

1. **Немедленно ревокните токен:**
   - Telegram: @BotFather → /revoke → создайте новый токен
   - Resend: Dashboard → API Keys → Delete → Create new
   - Database: Измените пароль в консоли провайдера

2. **Обновите .env.local локально**

3. **Обновите Vercel Environment Variables**

4. **Очистите git историю (опционально):**
```bash
# Используйте git-filter-repo или BFG Repo-Cleaner
# ⚠️ Это переписывает историю!

# Установка BFG
brew install bfg

# Удаление секретов
bfg --replace-text passwords.txt

# Принудительный пуш
git push --force
```

### 🔍 Проверка перед коммитом:

```bash
# Поиск возможных секретов
git grep -i "BOT_TOKEN\|RESEND_API_KEY\|password\|secret"

# Проверка staged файлов
git diff --cached | grep -i "token\|password\|secret"
```

### ✅ Чеклист безопасности:

- [ ] .env* файлы в .gitignore
- [ ] Секреты НЕ в коде (используем process.env)
- [ ] Секреты НЕ в документации
- [ ] Секреты НЕ в комментариях
- [ ] Секреты настроены в Vercel
- [ ] Используются свежие токены
- [ ] Никаких хардкодных значений

### 📚 Документация с примерами:

В документации используйте плейсхолдеры:
```bash
# ✅ Правильно
BOT_TOKEN="your_bot_token_from_botfather"

# ❌ Неправильно - НИКОГДА так не делайте!
BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789"  # Пример фейкового токена
```

### 🛡️ Git Hooks (опционально):

Создайте `.git/hooks/pre-commit`:
```bash
#!/bin/bash

# Проверка на секреты перед коммитом
if git diff --cached | grep -qiE 'BOT_TOKEN.*[0-9]{10}:[A-Za-z0-9_-]{35}'; then
  echo "❌ Найден Telegram BOT_TOKEN в коммите!"
  echo "Удалите секрет и попробуйте снова."
  exit 1
fi

if git diff --cached | grep -qiE 're_[A-Za-z0-9]{32}'; then
  echo "❌ Найден RESEND_API_KEY в коммите!"
  echo "Удалите секрет и попробуйте снова."
  exit 1
fi

exit 0
```

```bash
chmod +x .git/hooks/pre-commit
```

### 🔄 Ротация токенов:

Рекомендуется менять токены:
- **После утечки** - немедленно
- **Плановая ротация** - раз в 3-6 месяцев
- **При смене команды** - когда кто-то уходит

### 📞 Что делать при инциденте:

1. ✋ Остановите панику
2. 🔒 Ревокните скомпрометированный токен
3. 🔄 Создайте новый токен
4. 📝 Обновите везде
5. 🧹 Очистите историю (если нужно)
6. 📊 Проверьте логи на подозрительную активность
7. 📢 Уведомите команду

### 🎯 Лучшие практики:

✅ Используйте менеджеры секретов (Vercel, AWS Secrets Manager)
✅ Ротируйте токены регулярно
✅ Проверяйте код перед коммитом
✅ Используйте разные токены для dev/prod
✅ Ограничивайте права токенов (principle of least privilege)

❌ Не храните секреты в коде
❌ Не делитесь токенами в чатах/email
❌ Не используйте одинаковые токены везде
❌ Не коммитьте .env файлы
