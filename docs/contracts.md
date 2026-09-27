# Внешние контракты

## Источники истины

Frontend не хранит копии OpenAPI или AsyncAPI. Канонические спецификации
принадлежат сервисным репозиториям:

- [backend, ветка `docker/dev`](https://github.com/xyz-nebula/backend/tree/docker/dev) —
  OpenAPI генерируется приложением и публикуется его `/openapi.json`;
- [audio-engine OpenAPI](https://github.com/xyz-nebula/audio-engine/blob/dev/audio-engine-openapi.yaml)
  и [AsyncAPI](https://github.com/xyz-nebula/audio-engine/blob/dev/audio-engine-asyncapi.yaml)
  из рабочей ветки `dev`.

Спецификации в knowledge base являются справочным зеркалом, а не источником
истины. Перед изменением real adapters нужно сверить актуальную спецификацию и
код выбранной рабочей ветки сервиса. Runtime parsers frontend и fixtures в
`tests/fixtures` проверяют поведение frontend, но не доказывают совместимость с
сервисом.

## Browser-facing граница

Frontend использует только same-origin адреса:

- `/api/v1/*` для HTTP backend;
- `/audio/v1/audio-stream` для WebSocket audio-engine.

Vite и production reverse proxy удаляют внешний префикс `/api` или `/audio`
перед передачей запроса upstream. Bearer access token используется для HTTP и
передаётся audio-engine как query-параметр `token` в текущем протоколе.

## Реализованный frontend-контракт

`BackendAuthClient` реализует регистрацию, активацию, login, refresh, logout и
TOTP через `/v1/auth/*`.

`BackendNegotiationClient` сейчас вызывает:

| Метод | Upstream path | Назначение |
| --- | --- | --- |
| `POST` | `/v1/chats/` | Создать чат из `name`, `case_uuid`, `preparations` |
| `GET` | `/v1/chats/cases` | Загрузить каталог кейсов |
| `GET` | `/v1/chats/` | Получить идентификаторы чатов |
| `GET` | `/v1/chats/{uuid}` | Загрузить статус, кейс и сообщения |
| `PUT` | `/v1/chats/active` | Сделать чат активным перед voice-подключением |

Текстовый ход и audio ticket в real adapter не реализованы. `finishSession` и
`getResult` не вызывают backend и возвращают локальный демонстрационный разбор.

`AudioEngineClient` открывает `/v1/audio-stream?token=...`, отправляет control и
base64 PCM `audio` messages, принимает `audio_frame`, `transcript`, `error` и
`auth_error`. Захват формирует mono PCM s16le с частотой 24 kHz; входящие PCM-
кадры воспроизводятся Web Audio.

## Известные расхождения

До исправления этих пунктов живой `real/real/real` нельзя считать подтверждённым
сквозным режимом:

- backend ветки `docker/dev` публикует `/v1/chat/*` и принимает при создании
  только `name`, тогда как frontend использует `/v1/chats/*` и дополнительные
  поля;
- ожидаемая frontend форма case response отличается от текущей спецификации
  сервиса, в том числе полями подготовки ролей;
- выбранная пользователем роль хранится локально, но не входит в create-chat
  contract;
- AsyncAPI описывает `transcript.text` как завершённый текст, а frontend
  преобразует его в `transcript_delta` и накапливает как дельту;
- завершение backend-чата и получение серверного анализа отсутствуют во
  frontend real adapter.

Изменение этих контрактов является отдельной межсервисной задачей. Нельзя
«исправлять» документацию копированием желаемой схемы в этот репозиторий:
сначала меняется каноническая спецификация владельца сервиса, затем adapter,
runtime parser и contract tests frontend.
