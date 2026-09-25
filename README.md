# Арена переговоров — frontend

Frontend-прототип AI-тренажёра переговоров на React, Vite, TypeScript, Tailwind CSS и MUI.

## Запуск

Требуется Node `>=24.14.1 <25`.

```bash
npm install
cp .env.example .env
npm run dev
```

Основные проверки:

```bash
npm run typecheck
npm run lint
npm run build
npm run visual:smoke
npm run check
```

## Источники сервисов

Auth, переговоры и аудио переключаются независимо:

```dotenv
VITE_AUTH_SOURCE=real
VITE_NEGOTIATION_SOURCE=mock
VITE_AUDIO_SOURCE=mock
```

- `mock/mock/mock` — полностью локальный демонстрационный сценарий.
- `real/mock/mock` — реальная авторизация и mock-тренировки.
- `real/real/real` — реальные backend-чаты и голосовой audio-engine.

В real voice-режиме доступны только голосовые переговоры. Название выбранной карточки передаётся как название чата; роль и сценарий карточки пока не передаются AI. Завершение открывает явно помеченный демонстрационный разбор и не изменяет backend-статус чата.

## Same-origin proxy

Frontend во всех средах использует только относительные адреса:

```dotenv
VITE_API_BASE_URL=/api
VITE_AUDIO_WS_URL=/audio/v1/audio-stream
```

Dev-сервер Vite проксирует запросы по настраиваемым targets:

```dotenv
API_PROXY_TARGET=http://localhost:8080
AUDIO_PROXY_TARGET=http://localhost:8081
```

- `/api/*` направляется в backend с удалением `/api`;
- `/audio/*` направляется в audio-engine с удалением `/audio` и поддержкой WebSocket Upgrade.

Production reverse proxy должен предоставлять те же маршруты. Абсолютные browser-facing URL backend или audio-engine не поддерживаются; `VITE_AUDIO_WS_URL` обязан быть same-origin-путём.

## Real-контракты

Источники истины — только актуальные удалённые OpenAPI backend и OpenAPI/AsyncAPI audio-engine. Корневой `openapi.json` не используется.

Backend-контур:

- `POST /v1/chats/` — создать чат с `{ "name": "..." }`;
- `GET /v1/chats/` — получить список `{uuid, name}`;
- `GET /v1/chats/{uuid}` — получить статус и сообщения;
- `PUT /v1/chats/active` — активировать чат перед голосовым подключением.

Для истории frontend ограниченно параллельно загружает detail каждого чата. История backend является источником истины: сообщения дедуплицируются по `uuid` и сортируются по `sequence`. Frontend не отправляет голосовые транскрипты в message endpoint.

Audio-engine подключается через `/audio/v1/audio-stream?token=...`. Входные чанки — base64 mono PCM s16le, 24 кГц. Поддерживаются `audio`, `control`, `audio_frame`, `transcript`, `error` и `auth_error`; поле `text` события `transcript` содержит очередную текстовую дельту. После финального транскрипта frontend перечитывает backend-чат, чтобы получить сохранённые `uuid` и `sequence`.

## Маршруты и документация

Основные защищённые маршруты: `/home`, `/arena/:sessionId`, `/result/:sessionId`.

- [Карта маршрутов](docs/routes.md)
- [Авторизация](docs/auth.md)
- [API-границы](docs/api.md)
- [Styling policy](docs/styling.md)
- [Визуальные тесты](tests/visual/README.md)

`npm run visual:smoke` самостоятельно запускает Vite, сохраняет диагностические PNG в `artifacts/visual-smoke/` и не требует заранее запущенного frontend-процесса.
