-- Позиция в шапке профиля ЛЗ/ПЗ (правка владельца): в enum было только общее
-- «защитник». Старое значение DEFENSEMAN остаётся для уже заполненных профилей.
ALTER TYPE "HockeyPosition" ADD VALUE 'LEFT_DEFENSEMAN';
