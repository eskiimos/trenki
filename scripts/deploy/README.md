# Auto-deploy через GitHub webhook

Поток: `git push origin main` → GitHub стучит в `/api/webhook/github-deploy` →
Next.js пишет триггер-файл в shared volume → host-cron подбирает → deploy.sh
делает pull/build/migrate/up.

## Одноразовая настройка на проде

1. **Добавить `GITHUB_WEBHOOK_SECRET` в `.env.production`** (значение
   совпадает с тем, что в GitHub Repo Settings → Webhooks):
   ```
   GITHUB_WEBHOOK_SECRET=...
   ```

2. **Создать shared-директорию для триггер-файла:**
   ```sh
   mkdir -p /home/trenki/deploy-trigger
   chown 1001:1001 /home/trenki/deploy-trigger   # uid контейнера
   ```

3. **Положить скрипты на хост и сделать executable:**
   ```sh
   cp /home/trenki/scripts/deploy/deploy.sh        /home/trenki/deploy.sh
   cp /home/trenki/scripts/deploy/deploy-watch.sh  /home/trenki/deploy-watch.sh
   chmod +x /home/trenki/deploy.sh /home/trenki/deploy-watch.sh
   touch /var/log/trenki-auto-deploy.log
   ```

4. **Добавить cron-запись (root):**
   ```sh
   ( crontab -l 2>/dev/null | grep -v deploy-watch.sh ; \
     echo "* * * * * /home/trenki/deploy-watch.sh" ) | crontab -
   ```

5. **Применить compose-изменения (volume + env):**
   ```sh
   cd /home/trenki
   docker compose -f docker-compose.production.yml up -d app
   ```

## Проверка

```sh
# Webhook отвечает на ping (GitHub шлёт автоматически после создания):
curl -s https://trenki.app/api/webhook/github-deploy -X POST \
  -H "X-GitHub-Event: ping" | jq .

# Лог последнего деплоя:
tail -50 /var/log/trenki-auto-deploy.log

# Логи самого webhook'а (через docker):
docker logs trenki-app --tail 50 | grep webhook
```

## Откат / отключение

```sh
crontab -l | grep -v deploy-watch.sh | crontab -
```
И/или убрать webhook на GitHub.
