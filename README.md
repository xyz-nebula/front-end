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

## Поддерживаемые профили сервисов

Источники auth, переговоров и аудио задаются переменными `VITE_*_SOURCE`.
Поддерживаются три согласованных профиля:

| Профиль | Назначение | Ограничения |
| --- | --- | --- |
| `mock/mock/mock` | Полностью локальная демонстрация | Данные, переговоры, аудио и разбор имитируются в браузере |
| `real/mock/mock` | Основной профиль разработки | Auth/TOTP обращаются к backend, продуктовый сценарий остаётся демонстрационным |
| `real/real/real` | Частично поддерживаемый интеграционный профиль | Только voice; живой E2E не гарантирован, выбранная роль не передаётся сервису, итоговый разбор локальный |

Другие сочетания технически можно задать, но UI и тесты не считают их
поддерживаемыми.

В `real/real/real` frontend реализует HTTP-вызовы negotiation backend,
WebSocket-подключение к audio-engine, захват микрофона через AudioWorklet и
воспроизведение PCM. Это frontend-ready интеграция, а не подтверждение
совместимости развёрнутых сервисов: текущие контракты расходятся. Точные
ограничения перечислены в [документации контрактов](docs/contracts.md).

## Сетевые адреса

Браузер использует same-origin пути:

```dotenv
VITE_API_BASE_URL=/api
VITE_AUDIO_WS_URL=/audio/v1/audio-stream
```

При разработке Vite проксирует их на `API_PROXY_TARGET` и
`AUDIO_PROXY_TARGET`, удаляя публичные префиксы `/api` и `/audio`. Production
reverse proxy должен предоставлять такое же поведение, SPA fallback и
WebSocket Upgrade. Подробности находятся в
[runbook развёртывания](docs/deployment-and-integrations.md).

## Документация

- [Архитектура и профили сервисов](docs/architecture.md)
- [Внешние контракты](docs/contracts.md)
- [Развёртывание и интеграции](docs/deployment-and-integrations.md)
- [Маршруты приложения](docs/routes.md)
- [Авторизация](docs/auth.md)
- [Styling policy](docs/styling.md)
- [Тестирование](docs/testing.md)
