# Арена переговоров — frontend

Frontend-прототип AI-тренажёра переговоров на React, Vite, TypeScript и обычном
CSS с семантическими scoped-классами.

## Запуск

Требуется версия Node из `.node-version` и Google Chrome для Playwright.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

В POSIX shell файл окружения можно подготовить командой `cp .env.example .env`.
Если `.env` уже настроен, копировать его повторно не нужно.

Полная локальная проверка:

```shell
npm run check
```

## Режимы сервисов

Все сервисы атомарно выбираются обязательной переменной `VITE_SERVICE_MODE`.
Поддерживаются два режима:

| Режим | Назначение | Ограничения |
| --- | --- | --- |
| `mock` | Полностью локальная демонстрация | Text и voice, локальные данные и mock-анализ; сетевые сервисы не вызываются |
| `real` | Основной пользовательский сценарий | Backend и audio-engine; только voice; mock fallback отсутствует |

В `real` frontend реализует HTTP-вызовы negotiation backend,
WebSocket-подключение к audio-engine, захват микрофона через AudioWorklet и
воспроизведение PCM. После завершения переговоров frontend запускает evaluation
через backend, опрашивает состояние задания до шести минут и отображает
серверный результат контракта `2.0.0-rc.1`; browser не обращается к AI-сервису
напрямую. Mock-режим формирует автономный локальный разбор.

Отображаемая подготовка хранится в owner-scoped `localStorage`. В real-режиме
Arena показывает только локальный snapshot текущей сессии; если его нет, UI
сообщает, что подготовка недоступна на этом устройстве, и не подмешивает fixtures
или скрытые backend preparations.

Это frontend-ready интеграция, а не подтверждение совместимости развёрнутых
сервисов: перед использованием real-режима нужен живой smoke полного цикла. Точные
ограничения перечислены в [документации контрактов](docs/contracts.md).

## Сетевые адреса

Браузер использует same-origin пути:

```dotenv
VITE_SERVICE_MODE=real
VITE_API_BASE_URL=/api
VITE_AUDIO_WS_URL=/audio/v1/audio-stream
```

При разработке Vite проксирует их на `API_PROXY_TARGET` и
`AUDIO_PROXY_TARGET`, удаляя публичные префиксы `/api` и `/audio`. Production
reverse proxy должен предоставлять такое же поведение, SPA fallback и
WebSocket Upgrade. Подробности находятся в
[runbook развёртывания](docs/deployment-and-integrations.md).

## Документация

- [Архитектура и режимы сервисов](docs/architecture.md)
- [Внешние контракты](docs/contracts.md)
- [Развёртывание и интеграции](docs/deployment-and-integrations.md)
- [Маршруты приложения](docs/routes.md)
- [Авторизация](docs/auth.md)
- [Styling policy](docs/styling.md)
- [Тестирование](docs/testing.md)
