# 🔧 Добавление второго домена для Telegram Login

## Текущая ситуация

В BotFather настроен домен: **trenki.vercel.app**

Но ваше приложение на домене: **trenki.vercel.app**

## ✅ Решение: Добавить второй домен

Telegram поддерживает **несколько доменов** для одного бота!

### Шаги:

1. Откройте Telegram → @BotFather
2. Отправьте команды:

```
/setdomain
```

```
@trenkibot
```

```
trenki.vercel.app
```

### Что произойдёт:

BotFather добавит новый домен, **не удаляя** старый:

```
✅ Success! Users will be able to log in from:
trenki.vercel.app
```

Теперь Login Widget будет работать на **обоих** доменах:
- ✅ trenki.vercel.app
- ✅ trenki.vercel.app

## Проверка

После настройки откройте:

```
https://trenki.vercel.app/login
```

Ошибка "Bot domain invalid" должна исчезнуть! ✅

---

**Время выполнения:** 1 минута  
**Сложность:** Легко  
**Результат:** Login работает на обоих доменах

---

## 📝 Какой домен использовать?

Если у вас есть оба домена, рекомендую:

- **trenki.vercel.app** - основной production
- **trenki.vercel.app** - staging/preview

Или наоборот, как вам удобно! Telegram Login будет работать на обоих.

---

**Дата:** 17 октября 2025 г.
