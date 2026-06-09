#!/bin/sh
# Опрашивает /home/trenki/deploy-trigger/trigger дважды в минуту.
# Если файл есть — удаляет и запускает deploy.sh.
#
# Cron-запись (вызывается каждую минуту):
#   * * * * * /home/trenki/deploy-watch.sh
# Внутри даёт 2 проверки с интервалом 30с — этого хватает для разумного
# времени реакции на push.

TRIGGER=/home/trenki/deploy-trigger/trigger

check() {
  if [ -f "$TRIGGER" ]; then
    # Сразу удаляем чтобы не зациклиться, потом запускаем
    rm -f "$TRIGGER"
    /home/trenki/deploy.sh &
  fi
}

check
sleep 30
check
