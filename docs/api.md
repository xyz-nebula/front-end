# Границы API-контрактов

Источниками истины служат актуальные спецификации в удалённых репозиториях backend и audio-engine. Корневой `openapi.json` устарел и не используется при разработке, тестировании или генерации fixtures.

## Browser-facing маршруты

Frontend всегда работает через same-origin-префиксы:

- `/api/v1/*` — HTTP backend;
- `/audio/v1/audio-stream` — WebSocket audio-engine.

Vite в dev и reverse proxy в production удаляют `/api` или `/audio` перед передачей запроса сервису. Абсолютные адреса сервисов не попадают в клиентскую конфигурацию.

## Используемые backend API

Auth/TOTP реализованы в `BackendAuthClient`. Реальные переговоры используют:

| Метод | Browser path | Назначение |
| --- | --- | --- |
| POST | `/api/v1/chats/` | Создать чат |
| GET | `/api/v1/chats/` | Получить список чатов |
| GET | `/api/v1/chats/{uuid}` | Получить чат и сообщения |
| PUT | `/api/v1/chats/active` | Выбрать чат для audio-engine |

Frontend не создаёт голосовые сообщения через публичный message endpoint. Финальные транскрипции сохраняет audio-engine, после чего frontend перечитывает detail чата.

## Audio-engine

WebSocket использует JWT текущей auth-сессии и события удалённого AsyncAPI. После `auth_error` допускаются один refresh и одно повторное подключение. В браузере не логируются JWT и полный WebSocket URL.

Runtime-парсеры находятся в `src/services/real/targetContract.ts`, а изолированные DTO fixtures — в `tests/fixtures/serviceContracts.ts`. Спецификации целиком в frontend не копируются.
