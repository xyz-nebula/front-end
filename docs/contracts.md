# Внешние контракты

## Источники истины

Frontend не хранит копии OpenAPI или AsyncAPI. Канонические спецификации
принадлежат сервисным репозиториям:

- [backend, ветка `docker/dev`](https://github.com/xyz-nebula/backend/tree/docker/dev) —
  OpenAPI генерируется приложением и публикуется его `/openapi.json`;
- [AI evaluation response](https://github.com/xyz-nebula/ai-system/blob/dev/src/arena_ai/v2/evaluation_response.py) —
  публичная wire-модель результата версии `2.0.0-rc.1`;
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
| `POST` | `/v1/chats/{uuid}/evaluate` | Запустить серверную оценку без request body |
| `GET` | `/v1/chats/{uuid}/result` | Получить состояние задания и готовый результат |

Текстовый ход и audio ticket в real adapter не реализованы. `finishSession`
запускает evaluation, а `getResult` читает существующее задание: ручная проверка
после ошибки или долгого ожидания не делает повторный `POST /evaluate`.

Backend возвращает для evaluation статусы `pending`, `processing`, `done` и
`failed`. Ответ чтения имеет обёртку `{ status, result, error }`: `result`
обязателен только для `done`, а для незавершённых состояний и ошибки задания
frontend использует стабильные пользовательские сообщения. Конфликт
`already_evaluating` считается восстановлением уже запущенного задания;
`evaluation_not_found` — отсутствующим результатом, а не бесконечной обработкой.

В `done` backend передаёт публичный AI-контракт `EvaluationResponse`
`2.0.0-rc.1`. Frontend строго проверяет версию, все outcome/judge/trainer slots,
enum и error codes, три уникальные коллегии судей, а также индексы, авторство и
цитаты evidence относительно транскрипта из `GET /v1/chats/{uuid}`. Только после
этого wire DTO преобразуется в доменную модель. Несовместимый payload становится
ошибкой `invalid-response` и не отображается частично. Browser использует только
same-origin backend `/api/v1/*`: токен AI-сервиса и заголовок версии контракта не
являются ответственностью frontend.

Статусы чата `ongoing`, `evaluating`, `evaluated`, а также legacy `victory` и
`defeat` преобразуются соответственно в frontend-состояния `active`,
`finishing` и `finished`. `selected_role` и `preparations` разбираются как часть
публичного chat response; скрытая подготовка ролей из case response в UI не
попадает. При создании чата frontend инвертирует выбранный
пользователем индекс и передаёт в `selected_role` индекс роли AI-оппонента.

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
- целевой frontend create-chat contract содержит `case_uuid`, `preparations` и
  `selected_role`, но это нужно сверять с OpenAPI развёрнутого backend;
- AsyncAPI описывает `transcript.text` как завершённый текст, а frontend
  преобразует его в `transcript_delta` и накапливает как дельту;
- пока backend не сохраняет пользовательскую подготовку, серверный
  `plan_vs_reality` ожидаемо равен `null`; frontend не подмешивает вместо него
  локальный mock-анализ.

Изменение этих контрактов является отдельной межсервисной задачей. Нельзя
«исправлять» документацию копированием желаемой схемы в этот репозиторий:
сначала меняется каноническая спецификация владельца сервиса, затем adapter,
runtime parser и contract tests frontend.
