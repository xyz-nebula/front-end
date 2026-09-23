# Арена переговоров — frontend

Frontend-прототип AI-тренажёра переговоров.

## Стек

React, Vite, TypeScript, Tailwind CSS, MUI и React Router.

## Команды

```bash
npm install
npm run dev
npm run build
npm run lint
npm run visual:smoke
```

Для локального просмотра production-сборки используйте `npm run preview`.

## Режимы сервисов

Frontend разделяет источники авторизации, переговоров и аудио:

```dotenv
VITE_AUTH_SOURCE=mock|real
VITE_NEGOTIATION_SOURCE=mock|real
VITE_AUDIO_SOURCE=mock|real
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT_MS=20000
VITE_MOCK_LATENCY_MS=350
VITE_AUDIO_WS_URL=ws://localhost:8000/v1/audio-stream
```

Каждый source задаётся явно: неизвестное или пропущенное значение считается
ошибкой конфигурации. Сейчас поддерживаются полный demo (`mock/mock/mock`) и
demo с настоящей авторизацией (`real/mock/mock`). Real negotiation и audio —
типизированные заглушки с ошибкой `feature-unavailable`; они намеренно не
выполняют сетевых запросов до появления совместимых серверных контрактов.

## Существующий API авторизации

Клиент обращается к backend через относительный префикс `/api`. Во время
локальной разработки Vite проксирует запросы на backend и сохраняет полный путь,
включая `/api`.

Перед запуском dev-сервера скопируйте `.env.example` в `.env` и укажите полный
URL backend. Файл `.env` не отслеживается Git, а переменная без префикса
`VITE_` доступна только конфигурации Vite и не попадает в клиентский bundle:

```bash
API_PROXY_TARGET=https://your-backend.example
```

В режиме `VITE_AUTH_SOURCE=real` без `API_PROXY_TARGET` команда `npm run dev`
завершится с подсказкой по настройке. Полный mock demo не требует backend URL.
Production-хостинг также должен проксировать `/api/*` на настроенный backend без
удаления `/api`, поскольку backend не отвечает на браузерные CORS
preflight-запросы.

## Целевой контракт переговоров

Все защищённые HTTP-запросы используют существующий Bearer access token. Wire
DTO используют `snake_case`, а внутренние frontend-типы — `camelCase`.
Командные endpoint'ы получают неизменный при retry `Idempotency-Key`:

| Операция | Метод и путь | Ответ |
|---|---|---|
| Создать сессию | `POST /v1/negotiations` | session |
| Загрузить сессию и историю | `GET /v1/negotiations/{id}` | session |
| Выполнить атомарный текстовый ход | `POST /v1/negotiations/{id}/turns/text` | обе сохранённые реплики и статус |
| Получить одноразовый audio ticket | `POST /v1/negotiations/{id}/audio-ticket` | ticket |
| Завершить сессию | `POST /v1/negotiations/{id}/finish` | result state |
| Получить результат | `GET /v1/negotiations/{id}/result` | result state |
| Получить список сессий | `GET /v1/negotiations` | summary[] |

Запрос создания содержит `{ "case_id", "mode" }`, текстовый ход — `{ "text" }`.
Session содержит `id`, `case_id`, `mode`, `status`, `started_at`, опциональный
`finished_at` и `messages`. Сохранённая реплика содержит `id`, монотонный в
рамках сессии `sequence`, `speaker: "user" | "ai"`, `text`, `created_at`.
Текстовый ход является одной транзакцией и отвечает полями `user_message`,
`ai_message`, `session_status`; публичного сохранения AI-реплики через `is_ai`
нет.

Завершение и чтение результата возвращают одно из состояний:

```json
{ "status": "processing" }
{ "status": "failed", "message": "..." }
{ "status": "ready", "result": {
  "session_id": "...", "outcome": "victory", "score": 84,
  "summary": "...", "strengths": [], "improvements": [], "recommendations": []
} }
```

`finish` идемпотентен: повтор с тем же ключом возвращает состояние того же
результата. `GET result` допускает ограниченный polling, пока ответ
`processing`. Список сессий возвращает `id`, `case_id`, `mode`, `status`,
`started_at`, опциональные `finished_at` и `score`.

Ошибки HTTP должны иметь стабильные `code`, `message` и опциональный `field`.
Frontend отдельно различает HTTP, network, timeout, invalid response и
feature unavailable. GET можно повторять новой попыткой; create, text turn и
finish — только с исходным idempotency key. После 401 выполняются ровно один
refresh и один повтор через общий auth flow.

## Целевой контракт audio-engine

Backend выдаёт короткоживущий одноразовый ticket, привязанный к пользователю и
одной session:

```json
{ "ticket": "...", "expires_at": "2026-09-22T08:01:00Z", "protocol": "audio-engine.v1" }
```

Соединение открывается по
`/v1/audio-stream?ticket=<ticket>&protocol=audio-engine.v1`. Полный URL с ticket
нельзя логировать. При reconnect запрашивается новый ticket; старый не
переиспользуется. Browser отправляет control (`pause`, `resume`, `stop`,
`close`) и `audio_input` frames. Единственный допустимый input/output формат:
base64 PCM `pcm_s16le`, mono, 24 kHz, 16 bit; каждый frame содержит
положительный `sequence` и Unix `timestamp` в миллисекундах. MediaRecorder/WebM
не считается PCM и не должен отправляться как такой frame.

Серверные события:

- `transcript_partial`: `speaker`, полный актуальный snapshot `text`, не delta;
- `message_committed`: `event_id` и уже сохранённый backend `message`;
- `audio_frame`: `sequence`, `timestamp`, `format`, base64 `payload`;
- `error`: стабильные `code`, `message`, `recoverable`;
- `closed`: WebSocket `code`, безопасный `reason`, `reconnect_allowed`.

Audio-engine сохраняет final transcript обеих сторон во внутренний endpoint
`POST /v1/internal/negotiations/{sessionId}/transcripts` до отправки
`message_committed`. Запрос содержит `event_id`, `speaker`, `text`, `created_at`,
использует сервисную авторизацию и идемпотентность по `event_id`; ответом служит
сохранённая реплика с server `id` и `sequence`. Этот endpoint недоступен
браузеру.

Close policy должна различать ручное закрытие, истёкший/невалидный ticket,
перезапуск сервиса и невосстановимую protocol error. Автоматический reconnect
разрешён только при `reconnect_allowed: true`; `stop`/`close` пользователя его
не запускают. Конкретные close codes согласуются до реализации real adapter и
не должны угадываться frontend'ом.

## Reconciliation

Backend history после reload/reconnect — источник истины. Долговременная
дедупликация выполняется по `message.id`, порядок — по `message.sequence`.
`event_id` подавляет повтор только внутри текущего audio connection. Partial
transcript отображается отдельно, заменяется целиком каждым событием и
очищается после commit, disconnect или ошибки. Frontend никогда не пересылает
voice transcript в публичный message endpoint.

Runtime-парсеры целевых DTO и событий находятся в
`src/services/real/targetContract.ts`, а исполняемые fixtures проверяются в
`tests/visual/service-contracts.spec.ts`. Текущие backend CRUD message routes и
audio-engine JWT с `chat_uuid` несовместимы с этим контрактом и не используются
как временный обход.

## Визуальная проверка

`npm run visual:smoke` последовательно запускает два отдельных Vite-процесса
на свободных локальных портах: `real/mock/mock` для auth contract и resilience
с HTTP-перехватами Playwright, затем `mock/mock/mock` для полного demo flow и
визуальных сценариев. Оба процесса останавливаются после проверки. Установленный
Google Chrome нужен для Playwright; предварительно запускать `npm run dev` не
нужно. Значения источников в окружении не меняют режимы smoke-прогона.

Скриншоты сохраняются в `artifacts/visual-smoke/`. Папка очищается перед каждым
прогоном и не отслеживается Git. Эти файлы предназначены для локальной
диагностики: Codex открывает их через `view_image`; pixel-diff и эталонные
снимки в проекте не используются.

Среди диагностических кадров:

- `landing-desktop.png` для viewport `1440×900`;
- `landing-mobile.png` для viewport `390×844`.

Playwright-аргументы можно передать после `--`; при указании spec-файла
запускается только соответствующий режим, например:

```bash
npm run visual:smoke -- landing.spec.ts
```
