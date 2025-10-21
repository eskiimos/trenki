# PWA (Progressive Web App) - Треньки

## 🚀 Возможности PWA

Приложение "Треньки" теперь является полноценным Progressive Web App со следующими возможностями:

### ✅ Установка на устройство
- 📱 Установка на главный экран iOS/Android
- 💻 Установка как десктопное приложение (Chrome, Edge)
- 🎨 Полноэкранный режим без браузерных элементов
- 🏠 Запуск как нативное приложение

### ✅ Офлайн режим
- 🔄 Работа без интернета
- 💾 Кэширование статических ресурсов
- 📦 Стратегия "Network First" с Fallback на кэш
- ⚡ Быстрая загрузка благодаря Service Worker

### ✅ Push-уведомления
- 🔔 Поддержка Web Push API
- 📬 Уведомления о новых тренировках (готово к интеграции)

## 📦 Файлы PWA

```
public/
├── manifest.json          # Манифест приложения
├── sw.js                  # Service Worker
└── icons/
    ├── icon-app.svg       # Исходная SVG иконка
    ├── icon-192.png       # Иконка 192x192 (генерируется)
    └── icon-512.png       # Иконка 512x512 (генерируется)

src/
├── lib/
│   └── pwa.ts            # Утилиты PWA
├── components/
│   ├── PWAInit.tsx       # Инициализация PWA
│   └── InstallPWAButton.tsx  # Кнопка установки
└── app/
    └── offline/
        └── page.tsx      # Offline страница
```

## 🛠 Команды

### Генерация иконок
```bash
npm run generate:icons
```
Генерирует PNG иконки из SVG для PWA.

### Сборка с PWA
```bash
npm run build
```
Автоматически генерирует иконки и собирает проект.

## 📱 Как установить приложение

### iOS (Safari)
1. Открыть сайт в Safari
2. Нажать на кнопку "Поделиться" (внизу по центру)
3. Выбрать "На экран Домой"
4. Нажать "Добавить"

### Android (Chrome)
1. Открыть сайт в Chrome
2. Нажать на три точки (меню)
3. Выбрать "Установить приложение" или "Добавить на главный экран"
4. Нажать "Установить"

### Desktop (Chrome/Edge)
1. Открыть сайт в Chrome или Edge
2. Нажать на иконку установки в адресной строке (справа)
3. Нажать "Установить"

## 🔧 Настройка manifest.json

В `public/manifest.json` можно настроить:

- `name` - полное название приложения
- `short_name` - короткое название (для иконки)
- `theme_color` - цвет темы приложения (#445CFF)
- `background_color` - цвет фона при загрузке (#0A0E1A)
- `display` - режим отображения (standalone = полноэкранный)
- `icons` - иконки приложения разных размеров

## 🔄 Service Worker

Service Worker (`public/sw.js`) реализует:

1. **Стратегия кэширования "Network First"**:
   - Сначала попытка загрузить из сети
   - При ошибке - загрузка из кэша
   - Автоматическое обновление кэша

2. **Исключения**:
   - API запросы к Kinescope
   - Telegram WebApp API
   - Prisma Accelerate

3. **Автоматическое обновление**:
   - Проверка обновлений каждый час
   - Автоматическая перезагрузка при новой версии

## 🔔 Push-уведомления

### Включение уведомлений

```typescript
import { requestNotificationPermission, sendTestNotification } from '@/lib/pwa';

// Запросить разрешение
const granted = await requestNotificationPermission();

// Отправить тестовое уведомление
if (granted) {
  sendTestNotification('Треньки', 'Новая тренировка доступна!');
}
```

### Интеграция с бэкендом

Для отправки push-уведомлений с сервера используйте Web Push API:

```typescript
// Пример с web-push библиотекой
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  publicVapidKey,
  privateVapidKey
);

const subscription = /* получить от клиента */;

webpush.sendNotification(subscription, JSON.stringify({
  title: 'Треньки',
  body: 'Новое видео добавлено!',
  icon: '/icons/icon-192.png',
}));
```

## 📊 Тестирование PWA

### Chrome DevTools
1. Открыть DevTools (F12)
2. Вкладка "Application"
3. Секция "Manifest" - проверка манифеста
4. Секция "Service Workers" - проверка SW
5. Секция "Storage" - проверка кэша

### Lighthouse
1. Открыть DevTools (F12)
2. Вкладка "Lighthouse"
3. Выбрать "Progressive Web App"
4. Нажать "Generate report"

Приложение должно набрать 100 баллов по PWA метрикам.

## ⚙️ Vercel настройки

Убедитесь, что в `vercel.json` или настройках проекта:

1. Service Worker не кэшируется:
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ]
}
```

2. Манифест доступен:
```json
{
  "headers": [
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/manifest+json"
        }
      ]
    }
  ]
}
```

## 🎯 Компоненты для использования

### Кнопка установки PWA

```tsx
import InstallPWAButton from '@/components/InstallPWAButton';

export default function HomePage() {
  return (
    <div>
      {/* Ваш контент */}
      <InstallPWAButton />
    </div>
  );
}
```

Кнопка автоматически:
- Показывается только на поддерживаемых устройствах
- Скрывается после установки
- Имеет анимацию bounce

## 🐛 Troubleshooting

### Service Worker не регистрируется
- Проверьте HTTPS (обязательно для SW, кроме localhost)
- Очистите кэш браузера
- Проверьте консоль на ошибки

### Иконки не отображаются
- Запустите `npm run generate:icons`
- Проверьте наличие файлов в `public/icons/`
- Проверьте пути в manifest.json

### Приложение не предлагает установку
- Проверьте все критерии PWA в Lighthouse
- Убедитесь, что manifest.json корректен
- Проверьте, что Service Worker зарегистрирован
- На iOS нужно использовать Safari

## 📝 Чеклист запуска PWA

- [ ] Сгенерированы иконки (`npm run generate:icons`)
- [ ] Service Worker регистрируется без ошибок
- [ ] Manifest.json доступен по `/manifest.json`
- [ ] Lighthouse PWA score = 100
- [ ] Тестирование на iOS Safari
- [ ] Тестирование на Android Chrome
- [ ] Тестирование на Desktop Chrome
- [ ] Офлайн режим работает
- [ ] Установка приложения работает

## 🚀 Деплой

При деплое на Vercel все настроено автоматически:

1. `npm run build` автоматически генерирует иконки
2. Service Worker и manifest.json копируются в public
3. PWA готово к использованию

## 📚 Дополнительно

- [PWA Builder](https://www.pwabuilder.com/) - инструмент для тестирования PWA
- [Web.dev PWA](https://web.dev/progressive-web-apps/) - документация по PWA
- [Service Worker Cookbook](https://serviceworke.rs/) - рецепты для SW
