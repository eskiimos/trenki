#!/bin/bash

echo "🔍 Проверяю статус сборки на сервере..."
echo ""

ssh root@83.166.245.178 << 'EOF'
echo "📊 Screen сессии:"
screen -ls
echo ""

echo "🐳 Docker образы:"
docker images | grep -E "REPOSITORY|trenki"
echo ""

echo "📦 Docker контейнеры:"
docker ps -a
echo ""

echo "💾 Файл /tmp/build-final.log:"
if [ -f /tmp/build-final.log ]; then
    cat /tmp/build-final.log
else
    echo "Файл еще не создан (сборка в процессе)"
fi
EOF
