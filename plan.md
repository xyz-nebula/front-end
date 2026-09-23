# План frontend переговорного поединка на финальных контрактах

## 1. Цель

Реализовать frontend так, чтобы страницы, hooks и пользовательский сценарий уже
сейчас работали по целевой архитектуре продукта. До готовности backend и
audio-engine эту архитектуру полностью имитируют mock adapter'ы. После появления
серверных endpoint'ов должны замениться только adapter'ы и конфигурация, без
переписывания ArenaPage, ResultPage, HomePage и их hooks.

Изменять разрешено только frontend-репозиторий:

```text
C:\Users\user\orca\workspaces\front-end\connect-chat
```

Репозитории backend и audio-engine доступны только для чтения контрактов:

```text
C:\Users\user\UrFU\coolname\backend
C:\Users\user\UrFU\coolname\audio-engine
```

В рамках этого плана запрещено менять backend, audio-engine, базу данных или
LocalAI.

Результат этого плана — работающий frontend-прототип на mock и готовые границы
для будущих real adapter'ов. Реальная интеграция negotiation/audio в задачу не
входит: до появления совместимых серверных контрактов real adapter'ы остаются
типизированными заглушками.

## 1.1. Зафиксированные решения

- target-контракты сначала фиксируются типами и fixtures, затем реализуется UI;
- `finishSession` допускает состояния `processing`, `ready`, `failed`;
- partial transcript содержит полный актуальный текст, а не delta;
- долговременная дедупликация сообщений выполняется по `message.id`;
- `eventId` дедуплицируется только в рамках audio connection;
- один `AudioClient` создаётся на одну arena session;
- mock registration показывает demo-ссылку активации;
- mock server data хранится в localStorage намеренно; запрет localStorage для
  server-owned metadata относится только к будущему real adapter.

## 2. Целевая ответственность сервисов

### 2.1. Backend — источник истины

В финальной архитектуре backend отвечает за:

- создание и владение negotiation session;
- связь session с кейсом, пользователем и режимом;
- историю сообщений обеих сторон;
- атомарную обработку текстового хода;
- выдачу короткоживущего audio ticket;
- приём сохранённых audio transcript events от audio-engine;
- завершение сессии;
- расчёт и хранение результата;
- список сессий и прогресс пользователя;
- идемпотентность команд и событий.

Frontend не определяет автора сохранённого сообщения через `is_ai`, не вызывает
LLM и не сохраняет голосовые transcript самостоятельно.

### 2.2. Audio-engine — realtime voice transport

В финальной архитектуре audio-engine отвечает за:

- проверку короткоживущего ticket, связанного с session/chat и пользователем;
- приём аудиофреймов браузера;
- передачу аудио в LocalAI;
- получение partial/final transcript пользователя;
- получение аудио и transcript ответа AI;
- сохранение final transcript обеих сторон в backend через внутренний
  авторизованный API;
- отправку frontend live transcript events и аудиофреймов;
- pause/resume/stop/close и согласованные close codes.

Final transcript считается подтверждённым только после сохранения в backend.
Audio-engine должен прислать frontend уже сохранённое сообщение с server id и
sequence. Partial transcript является временным UI-состоянием и не попадает в
историю.

### 2.3. Frontend — управление пользовательским сценарием

Frontend отвечает за:

- auth UX и хранение пользовательской сессии;
- создание/загрузку negotiation session через backend client;
- отправку текстового хода одной командой;
- получение audio ticket через backend client;
- передачу микрофонных фреймов audio client;
- отображение partial transcript;
- отображение подтверждённых сообщений;
- воспроизведение аудиофреймов;
- завершение сессии и отображение результата;
- восстановление состояния с backend после reload/reconnect.

Frontend не является посредником для сохранения voice transcript. Потеря или
закрытие вкладки не должна приводить к потере уже распознанной реплики.

## 3. Целевые потоки

### 3.1. Текстовый ход

```text
Frontend -> Backend: sendTextTurn(sessionId, text, clientTurnId)
Backend: проверить владельца и идемпотентность
Backend: сохранить user message
Backend -> AI: получить ответ
Backend: сохранить AI message
Backend -> Frontend: userMessage + aiMessage + sessionStatus
```

Это одна доменная операция. ArenaPage никогда не выполняет два отдельных
`POST /message/` для user и AI.

### 3.2. Голосовой ход

```text
Frontend -> Backend: createAudioTicket(sessionId)
Backend -> Frontend: short-lived ticket
Frontend -> Audio-engine: WebSocket connect(ticket)
Frontend -> Audio-engine: audio frames
Audio-engine -> Frontend: user transcript partial
Audio-engine -> Backend: persist user transcript
Audio-engine -> Frontend: committed user message
Audio-engine/LocalAI: generate AI response
Audio-engine -> Frontend: AI transcript partial + audio frames
Audio-engine -> Backend: persist AI transcript
Audio-engine -> Frontend: committed AI message
```

При reconnect/reload frontend вызывает `getSession(sessionId)` и использует
backend history как источник истины. Он не отправляет полученные transcript
обратно в публичный message endpoint.

### 3.3. Завершение

```text
Frontend -> Backend: finishSession(sessionId, clientCommandId)
Backend: закрыть session идемпотентно
Backend: сформировать/получить result
Backend -> Frontend: NegotiationResult
Frontend -> ResultPage
```

## 4. Отношение к существующим сервисам

### 4.1. Что уже можно переиспользовать

Текущий backend auth contract используется real auth adapter'ом:

```text
POST   /v1/auth/register
POST   /v1/auth/register/activate
POST   /v1/auth/login
POST   /v1/auth/token/refresh
POST   /v1/auth/logout
POST   /v1/auth/totp/enroll
POST   /v1/auth/totp/confirm
DELETE /v1/auth/totp
```

Существующие auth UX, token storage, refresh, logout и межвкладочная
синхронизация должны сохраниться.

### 4.2. Что не использовать как доменный API переговоров

Текущие маршруты:

```text
POST   /v1/chat/{chatUuid}/message/
DELETE /v1/chat/{chatUuid}/message/{messageUuid}
```

являются низкоуровневыми CRUD-примитивами. ArenaPage и negotiation mock не
должны строить на них основной сценарий. В частности, frontend не должен
сохранять mock AI response через `{ "is_ai": true }`.

Удаление отдельного сообщения не входит в UX переговорного поединка. Поэтому
`deleteMessage` не включается в обязательный frontend contract. Если позже
появится управление историей, оно проектируется отдельной задачей вокруг
session-level API.

### 4.3. Текущие серверные блокеры

Backend пока не имеет публичных endpoint'ов для:

- negotiation session;
- атомарного text turn;
- audio ticket;
- finish/result;
- session history/progress.

Audio-engine пока:

- требует JWT с `chat_uuid`, который backend не выдаёт;
- не отправляет transcript в браузер;
- сохраняет только AI transcript;
- использует отдельный статический backend bearer token;
- не имеет согласованного input PCM contract;
- расходится с документацией по close codes;
- фактически не реализует pause/resume.

Поэтому real negotiation и real audio в рамках текущего frontend плана являются
adapter boundaries, а не работающими интеграциями. Запрещено обходить блокеры
генерацией JWT в браузере, постоянным `VITE_*` token или пересылкой backend
access token в audio-engine.

## 5. Конфигурация

Использовать независимые источники:

```text
VITE_AUTH_SOURCE=mock|real
VITE_NEGOTIATION_SOURCE=mock|real
VITE_AUDIO_SOURCE=mock|real

VITE_API_BASE_URL=/api
VITE_API_TIMEOUT_MS=20000
VITE_MOCK_LATENCY_MS=350
VITE_AUDIO_WS_URL=ws://localhost:8000/v1/audio-stream
```

Поддерживаемые сейчас режимы:

| Режим | Auth | Negotiation | Audio | Назначение |
|---|---|---|---|---|
| Полный demo | mock | mock | mock | автономная демонстрация и visual smoke |
| Demo с backend auth | real | mock | mock | использование существующей авторизации |

`real` negotiation и audio зарезервированы для будущих adapter'ов. Пока они
возвращают типизированную `feature-unavailable` и не выполняют сетевой запрос.

Правила конфигурации:

- неизвестное значение завершает запуск понятной ошибкой;
- mock включается только явно;
- production не переключается на mock молча;
- компоненты не читают `import.meta.env`;
- visual smoke всегда задаёт полный demo и не требует `API_PROXY_TARGET`;
- Vite требует `API_PROXY_TARGET` только при `VITE_AUTH_SOURCE=real` или после
  появления другого работающего HTTP adapter'а.

Для существующего backend через dev Caddy:

```text
API_PROXY_TARGET=http://localhost:8080
VITE_API_BASE_URL=/api
```

## 6. Внутренние типы

Добавить:

```text
src/types/api.ts
src/types/negotiation.ts
src/types/audio.ts
```

Новые внутренние типы используют camelCase. Snake_case разрешён только в DTO
реальных adapter'ов. Существующие auth-типы пока не мигрировать, чтобы не
создавать лишний риск для готового auth flow.

```ts
type ApiErrorReason =
  | 'http'
  | 'network'
  | 'timeout'
  | 'invalid-response'
  | 'feature-unavailable'

type NegotiationMode = 'text' | 'voice'
type NegotiationStatus = 'active' | 'finishing' | 'finished'
type MessageSpeaker = 'user' | 'ai'

interface NegotiationMessage {
  id: string
  sequence: number
  speaker: MessageSpeaker
  text: string
  createdAt: string
}

interface NegotiationSession {
  id: string
  caseId: string
  mode: NegotiationMode
  status: NegotiationStatus
  startedAt: string
  finishedAt?: string
  messages: NegotiationMessage[]
}

interface NegotiationResult {
  sessionId: string
  outcome: 'victory' | 'defeat'
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  recommendations: string[]
}

interface NegotiationSessionSummary {
  id: string
  caseId: string
  mode: NegotiationMode
  status: NegotiationStatus
  startedAt: string
  finishedAt?: string
  score?: number
}

type NegotiationResultState =
  | { status: 'processing' }
  | { status: 'ready'; result: NegotiationResult }
  | { status: 'failed'; message: string }

interface TextTurnResult {
  userMessage: NegotiationMessage
  aiMessage: NegotiationMessage
  sessionStatus: NegotiationStatus
}

interface AudioTicket {
  ticket: string
  expiresAt: string
  protocol: 'audio-engine.v1'
}

interface AudioFormat {
  codec: 'pcm_s16le'
  sampleRate: 24000
  channels: 1
  bitDepth: 16
}

interface AudioInputFrame {
  sequence: number
  timestamp: number
  format: AudioFormat
  payload: string
}
```

UI состояния хранятся независимо:

```ts
type SessionViewState = 'loading' | 'ready' | 'finishing' | 'finished' | 'error'
type TurnState = 'idle' | 'sending' | 'thinking' | 'error'
type AudioConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'paused'
  | 'stopped'
  | 'reconnecting'
  | 'error'
```

## 7. Финальные frontend ports

Создать:

```text
src/services/contracts/authClient.ts
src/services/contracts/negotiationClient.ts
src/services/contracts/audioClient.ts
```

### 7.1. NegotiationClient

```ts
interface NegotiationClient {
  createSession(input: {
    caseId: string
    mode: NegotiationMode
    clientCommandId: string
  }): Promise<NegotiationSession>

  getSession(sessionId: string): Promise<NegotiationSession>

  sendTextTurn(input: {
    sessionId: string
    text: string
    clientTurnId: string
  }): Promise<TextTurnResult>

  createAudioTicket(sessionId: string): Promise<AudioTicket>

  finishSession(input: {
    sessionId: string
    clientCommandId: string
  }): Promise<NegotiationResultState>

  getResult(sessionId: string): Promise<NegotiationResultState>
  listSessions(): Promise<NegotiationSessionSummary[]>
}
```

`clientCommandId` и `clientTurnId` генерируются один раз на пользовательское
действие и повторно используются при безопасном retry того же действия.

Интерфейс намеренно не содержит `addMessage`, `isAi` и `deleteMessage`.

### 7.2. AudioClient

```ts
type AudioEngineEvent =
  | {
      type: 'transcript_partial'
      speaker: MessageSpeaker
      text: string
    }
  | {
      type: 'message_committed'
      eventId: string
      message: NegotiationMessage
    }
  | {
      type: 'audio_frame'
      sequence: number
      timestamp: number
      format: AudioFormat
      payload: string
    }
  | {
      type: 'error'
      code: string
      message: string
      recoverable: boolean
    }
  | {
      type: 'closed'
      code: number
      reason: string
      reconnectAllowed: boolean
    }

interface AudioClient {
  getState(): AudioConnectionState
  connect(input: { sessionId: string; ticket: AudioTicket }): Promise<void>
  sendAudio(frame: AudioInputFrame): void
  sendControl(action: 'pause' | 'resume' | 'stop' | 'close'): void
  subscribe(listener: (event: AudioEngineEvent) => void): () => void
  subscribeState(listener: (state: AudioConnectionState) => void): () => void
  disconnect(): Promise<void>
}
```

`message_committed` означает, что audio-engine уже сохранил transcript в
backend. Frontend добавляет сообщение в UI. `eventId` защищает от повторного
события в текущем connection, а после reload/reconnect история сверяется по
`message.id` и `sequence`.

### 7.3. Auth и защищённые запросы

Auth client повторяет существующие операции `authApi`. `AuthContext` остаётся
владельцем токенов и единственного refresh flow.

Auth storage получает `source: 'mock' | 'real'` и стабильный `mockOwnerKey`.
`mockOwnerKey` создаётся при новой frontend-сессии, сохраняется при refresh и
используется только для изоляции mock negotiation data. Страницы не получают и
не декодируют tokens. Старый auth storage мигрируется как `source: 'real'`.

Будущий real negotiation adapter должен выполнять защищённые запросы через
существующую семантику `runAuthorized`: первоначальный запрос, один refresh
после 401 и один повтор. Страницы и hooks не получают access token.

### 7.4. Target wire contract

Real stubs документируют, но пока не вызывают:

| Метод | Target path | Idempotency |
|---|---|---|
| createSession | `POST /v1/negotiations` | `Idempotency-Key` |
| getSession | `GET /v1/negotiations/{id}` | — |
| sendTextTurn | `POST /v1/negotiations/{id}/turns/text` | `Idempotency-Key` |
| createAudioTicket | `POST /v1/negotiations/{id}/audio-ticket` | — |
| finishSession | `POST /v1/negotiations/{id}/finish` | `Idempotency-Key` |
| getResult | `GET /v1/negotiations/{id}/result` | — |
| listSessions | `GET /v1/negotiations` | — |

Wire DTO используют snake_case и проверяются runtime parser'ами. WebSocket target:
`/v1/audio-stream?ticket=<short-lived-ticket>&protocol=audio-engine.v1`.
Frontend не логирует полный URL. Ticket одноразовый, привязан к session/user и
при reconnect запрашивается заново. Partial transcript — snapshot. Committed
event содержит `event_id` и сохранённый `message`.

## 8. Реализации и dependency injection

Создать:

```text
src/services/mock/mockAuthClient.ts
src/services/mock/mockNegotiationClient.ts
src/services/mock/mockAudioClient.ts
src/services/mock/mockRuntime.ts

src/services/real/backendAuthClient.ts
src/services/real/backendNegotiationClient.ts
src/services/real/audioEngineClient.ts

src/services/config.ts
src/services/ServiceAdaptersContext.tsx
src/services/DomainServicesContext.tsx
```

Composition root:

```text
ServiceAdaptersProvider
  AuthProvider
    DomainServicesProvider
      App
```

- adapters provider читает env и создаёт выбранные низкоуровневые adapter'ы;
- AuthProvider использует auth client и предоставляет `runAuthorized`;
- domain provider создаёт защищённый negotiation client и factory для создания
  отдельного audio client на arena session;
- страницы получают только финальные ports;
- pages/hooks не импортируют mock/real реализации напрямую.

`backendNegotiationClient` и `audioEngineClient` на текущем этапе являются
явными заглушками `feature-unavailable`. Не нужно реализовывать в них текущие
несовместимые CRUD/WS обходы. Их методы и файлы фиксируют место будущей замены.

## 9. Mock runtime, имитирующий финальную систему

### 9.1. Storage

Использовать versioned ключ:

```text
arena.mock.data.v1
```

Хранить mock users, sessions, messages, results, использованные command ids и
audio event ids. Данные разделяются по userId.

Storage обязан:

- валидировать JSON;
- переживать повреждённое значение без падения приложения;
- выдавать стабильные UUID;
- обеспечивать монотонный sequence;
- дедуплицировать `clientCommandId`, `clientTurnId` и `eventId`;
- не читать и не записывать реальные tokens;
- сериализовать мутации через локальную очередь и `navigator.locks`, чтобы
  вкладки не получили одинаковый sequence;
- в fallback без Web Locks поддерживать одну активную mock arena-вкладку и
  показывать понятную ошибку во второй.

### 9.2. Mock negotiation

Сценарии хранить отдельно:

```text
src/mocks/negotiation-scenarios.ts
```

Mock negotiation ведёт себя как будущий backend:

- `createSession` сохраняет caseId/mode и возвращает session;
- повтор с тем же command id возвращает ту же session;
- `sendTextTurn` одной операцией сохраняет user и AI messages;
- повтор с тем же turn id не создаёт сообщения повторно;
- `createAudioTicket` возвращает короткоживущий mock ticket;
- `finishSession` идемпотентно создаёт `processing`, затем стабильный `ready`
  result; ResultPage опрашивает `getResult` с ограниченным backoff;
- `getSession`, `getResult`, `listSessions` читают сохранённые данные.

Mock AI response выбирается детерминированно по caseId и номеру хода. UI не
должен знать, как выбран ответ.

### 9.3. Mock audio

`mockRuntime` представляет приватный канал между mock audio-engine и mock
backend. Он не экспортируется страницам.

Mock voice flow:

1. UI получает ticket через `NegotiationClient.createAudioTicket`.
2. `MockAudioClient.connect` проверяет ticket и session.
3. Client имитирует partial user transcript.
4. Mock audio-engine через `mockRuntime` сохраняет final user message.
5. Только после сохранения client отправляет `message_committed`.
6. Затем имитируются partial AI transcript и audio frames.
7. Mock runtime сохраняет final AI message.
8. Client отправляет второе `message_committed`.

Таким образом frontend выполняет тот же flow, который позднее выполнит реальный
audio-engine. Arena hook не вызывает `addMessage` в ответ на transcript event.

По умолчанию mock не запрашивает микрофон. Дополнительный demo microphone режим
использует `getUserMedia` только для permission UX и останавливает все tracks при
disconnect. Рабочего пути `microphone → PCM → sendAudio` сейчас нет:
`sendAudio` объявлен как target port, но capture-код его не вызывает. Отправка
MediaRecorder/WebM как PCM запрещена.

Partial event всегда содержит полный актуальный transcript. После commit,
disconnect или ошибки partial очищается. События от старого connection после
reconnect игнорируются.

## 10. UI flow

### 10.1. TrainingModal

Расширить существующий modal:

- выбор text/voice;
- loading, disabled и error состояния;
- создание session через `NegotiationClient.createSession`;
- один command id на одно нажатие;
- переход на `/arena/{sessionId}` после успеха.

### 10.2. ArenaPage

Добавить:

```text
src/pages/ArenaPage.tsx
src/features/arena/useArenaSession.ts
src/components/arena/*
```

Защищённый route:

```text
/arena/:sessionId
```

`useArenaSession`:

- загружает session;
- отправляет text turn одной командой;
- блокирует двойной submit;
- после reload заново загружает session;
- завершает session одной командой;
- хранит незавершённые command/turn id в `sessionStorage` и очищает после
  подтверждённого успеха;

`useArenaAudio` получает audio ticket перед connect, подписывается на events,
показывает partial отдельно от history, добавляет только `message_committed` с
дедупликацией и при reconnect сверяет backend history. При cleanup он снимает
listeners, останавливает playback/MediaStream и отключает transport.

Страница отображает case/opponent, таймер, сообщения, thinking, partial voice
transcript, text input или voice controls, finish confirmation, reconnect и
loading/error/empty states.

### 10.3. ResultPage и HomePage

Добавить route:

```text
/result/:sessionId
```

ResultPage вызывает `getResult`, отображает processing/error и после готовности
показывает outcome, score, summary, strengths, improvements и recommendations.
Повтор кейса создаёт новую session с новым command id.

HomePage получает историю через `listSessions`. Статические progress-значения
остаются явно демонстрационными до появления соответствующего backend contract.

В mock-режиме result и progress помечаются как demo.

## 11. Ошибки и retry

Общие ошибки различают:

- HTTP status и backend `code/message/field`;
- network/timeout;
- invalid response/event;
- feature unavailable;
- expired audio ticket;
- WebSocket close;
- LocalAI error;
- microphone denial.

Правила retry:

- GET можно повторять;
- create/send/finish можно повторять только с исходным command/turn id;
- новое пользовательское действие получает новый id;
- reconnect получает новый audio ticket;
- manual close не запускает reconnect;
- токены и URL с ticket не попадают в логи или UI.

Target fixture фиксирует, что audio ticket короткоживущий, привязан к одной
session и не переиспользуется после reconnect. Способ передачи ticket, точные
HTTP paths, DTO, internal auth и close codes документируются как требования к
будущим сервисам, но real network code сейчас не реализуется.

## 12. Этапы разработки

Этапы выполняются строго последовательно. Команда «выполняем этап N» означает
работу только в границах этого этапа.

### Этап 1 — контракты и типы

- зафиксировать ports, DTO/event fixtures, ошибки и config;
- определить result processing, audio format, retry и reconciliation;
- добавить real negotiation/audio stubs без сетевых запросов;
- описать target backend/audio requirements в README.

Готово: типы компилируются, fixtures валидируются, спорных контрактов не осталось.

### Этап 2 — auth и composition root

- вынести `authApi` в `AuthClient` без изменения поведения;
- добавить source-aware auth storage и `mockOwnerKey`;
- собрать providers и factories;
- настроить env parsing и режимы запуска.

Готово: прежние auth tests проходят, UI не импортирует реализации adapter'ов.

### Этап 3 — mock domain

- реализовать mock auth и demo activation link;
- реализовать versioned storage, Web Lock и idempotency;
- реализовать mock negotiation, result processing и mock runtime;
- реализовать mock audio events, reconnect и cleanup.

Готово: lint/build проходят; runtime детерминирован, не импортируется страницами
и готов к подключению в этапе 4.

### Этап 4 — текстовый сценарий

- расширить TrainingModal;
- добавить ArenaPage, route и `useArenaSession`;
- реализовать create/load/text turn/finish;
- добавить loading/error/empty/disabled состояния и reload recovery.

Готово: полный text flow работает на desktop/mobile без дублей.

### Этап 5 — голос, результат и история

- добавить voice controls, partial transcript и committed messages;
- добавить ResultPage с processing/polling;
- подключить HomePage history;
- реализовать playback mock, reconnect и resource cleanup.

Готово: полный mock flow работает от login/register до result и переживает reload.

### Этап 6 — проверка готовности

- разделить Playwright-запуски по env-режимам;
- закрыть resilience, idempotency, cleanup и corrupted storage cases;
- проверить отсутствие network calls у real stubs;
- выполнить lint, build, visual smoke и открыть desktop/mobile PNG.

Статус: mock/resilience часть этапа выполнена, включая изоляцию поздних операций,
привязку audio client к arena, идемпотентные retry, устойчивый storage, очередь
playback и cleanup при отказе audio. Это не означает готовность real-интеграции.
Отдельно остаются согласование внешних контрактов, microphone/PCM capture,
реализация real negotiation/audio adapters и интеграционная проверка с сервисами.
До неё нельзя утверждать, что замена mock ограничится только adapter-файлами.

Перед real-режимом подписи `ResultPage`, истории `HomePage`, `VoiceControls` и
`TrainingModal` должны стать source-aware; сейчас часть текста намеренно
описывает demo независимо от выбранного источника.


## 13. Тестирование

Не добавлять новый test framework. Использовать Playwright.

Запуски разделить по режимам:

- auth contract/resilience: `real / mock / mock`, HTTP перехватывает Playwright;
- полный demo flow и visual smoke: `mock / mock / mock`;
- режимы запускаются отдельными Vite-процессами, потому что env фиксируется при
  старте.

Добавить:

```text
tests/visual/arena-text.spec.ts
tests/visual/arena-voice.spec.ts
tests/visual/result.spec.ts
tests/visual/service-contracts.spec.ts
```

Проверить:

1. mock register/activate/login/refresh/logout;
2. create session и idempotent повтор command id;
3. text turn одной клиентской операцией;
4. отсутствие вызовов `/chat/*/message/` из Arena;
5. дедупликацию повторного turn id;
6. reload session;
7. voice ticket до connect;
8. partial transcript не попадает в persisted history;
9. committed user/AI messages появляются после mock runtime commit;
10. дедупликацию audio event id;
11. reconnect с новым ticket;
12. cleanup WebSocket/listeners/timers/MediaStream;
13. finish/result и idempotent finish;
14. corrupted localStorage;
15. изоляцию mock users;
16. real negotiation/audio stubs без сетевых запросов;
17. desktop/mobile и отсутствие horizontal overflow.

После каждого этапа запускать:

```bash
npm run lint
npm run build
```

После этапов с UI/CSS дополнительно запускать `npm run visual:smoke` и открыть
соответствующие PNG из
`artifacts/visual-smoke/` через `view_image`. PNG не коммитить.

## 14. Запрещённые временные решения

Нельзя:

- строить Arena flow на отдельных `POST /message/` для user и AI;
- передавать `is_ai: true` из frontend;
- сохранять voice transcript через frontend;
- хранить real server-owned session metadata только в localStorage;
- выдавать mock result за real backend result;
- генерировать или подписывать JWT в браузере;
- передавать backend access token в audio-engine;
- хранить audio ticket или secret в `VITE_*`;
- автоматически повторять команду с новым id после timeout;
- добавлять зависимости без отдельного согласования;
- менять backend или audio-engine;
- коммитить visual smoke artifacts.

## 15. Критерий готовности

План выполнен, когда:

- полный сценарий работает локально на mock;
- frontend использует только финальные AuthClient, NegotiationClient и
  AudioClient ports;
- text turn является одной доменной операцией;
- voice transcript сохраняет mock audio-engine через приватный mock runtime;
- UI не вызывает message CRUD и не определяет `isAi` при сохранении;
- session, idempotency и result переживают reload;
- real adapter stubs явно сообщают о недоступности и не выполняют временные
  несовместимые запросы;
- documented target DTO/events достаточно для реализации real adapter без
  изменения UI;
- loading/error/empty/disabled/reconnect состояния видны пользователю;
- desktop и mobile layout визуально проверены;
- `npm run lint`, `npm run build` и `npm run visual:smoke` проходят;
- в README перечислены обязательные внешние контракты: session CRUD, atomic
  text turn, audio ticket, internal transcript commit, committed message event,
  finish/result, session list, input PCM и close/reconnect policy.
