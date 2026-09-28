# Аудит моков и жёстко заданных данных frontend

Дата аудита: 29 сентября 2026 года.

## Область и источники

Проверены:

- весь runtime-код `src/` frontend, включая mock/real adapters, страницы, feature hooks и статические данные;
- актуальный развёрнутый OpenAPI: <https://nebula.tx0.su/api/openapi.json> (`Website Profile Backend`, версия `1.0.0`);
- локальный backend `C:\Users\user\UrFU\coolname\backend` на ветке `dev`, commit `9864fa1`;
- локальный audio-engine `C:\Users\user\UrFU\coolname\audio-engine` на ветке `dev`, commit `5f9b9c8`;
- frontend-документация о профилях и контрактах.

В ходе аудита код не менялся. Целевой и основной пользовательский сценарий — строго `real/real/real`: реальные auth, negotiation backend и audio-engine. Mock-профили ниже рассматриваются только как оставшийся demo/test-код, а не как штатный вариант запуска.

## Краткий итог

1. Целевая конфигурация уже зафиксирована в `.env.example` как `real/real/real`. Полностью реальными в ней могут быть auth/TOTP, каталог кейсов, создание и чтение чатов, выбор роли, сохранение подготовки в чат, голосовой разговор, транскрипт, история сообщений и итоговый AI-разбор.
2. Даже в целевом `real/real/real` composition root безусловно создаёт mock storage/runtime, а real-код продолжает зависеть от mock-данных: `trainingCases`, `duelPreparation`, локального snapshot подготовки, статических role summaries, цветов и иконок кейсов.
3. Главная страница содержит явно вымышленные пользовательские показатели: имя «Кирилл», серия 4 дня, уровень 4, `720 / 900 XP`, прогресс подготовки 65%. Текущий backend не предоставляет API, которым их можно честно заменить.
4. Реальный текстовый режим пока невозможен. Backend умеет сохранить сообщение, но не имеет endpoint, который генерирует ответ AI. Реальный AI-диалог реализован только через WebSocket audio-engine.
5. Сервер уже возвращает больше полезных данных, чем использует frontend: `goal`, `selected_role`, `preparations`, активный чат. Часть локальных подстановок можно удалить без добавления нового backend API.
6. OpenAPI не содержит профиля текущего пользователя, статистики/геймификации, рекомендаций, изображения/темы кейса, публичных описаний ролей и структурированного черновика подготовки. Для удаления соответствующих заглушек нужен новый контракт или удаление этих блоков из UI.
7. В контракте кейса всем авторизованным пользователям выдаются `system_prompt` и подготовки обеих ролей. Использовать эти поля как UI-описания ролей нельзя без отдельного продуктового и security-решения: это может раскрыть скрытую позицию AI и системный prompt.

## Целевой профиль и фактическая сборка adapters

`src/services/ServiceAdaptersContext.tsx` выбирает каждый adapter по `VITE_*_SOURCE`. В актуальном `.env.example` установлено:

```dotenv
VITE_AUTH_SOURCE=real
VITE_NEGOTIATION_SOURCE=real
VITE_AUDIO_SOURCE=real
```

Следовательно, аудит реального сценария должен исходить только из реальных adapters. Локальный текстовый demo и прочие mock-возможности не являются допустимой подменой отсутствующей real-функции.

При этом composition root безусловно импортирует `MockAudioClient`, `MockAuthClient`, `MockNegotiationClient`, `MockRuntime` и `MockStorage`, а затем создаёт `MockStorage` и `MockRuntime` до проверки выбранных sources. Поэтому mock-код входит в dependency graph и mock runtime создаётся даже при `real/real/real`; методы хранения не вызываются, но изоляция целевого runtime неполная.

`README.md` и `docs/architecture.md` всё ещё называют `real/mock/mock` основным профилем разработки, а `real/real/real` — частично поддерживаемым интеграционным. Это документационный drift относительно заданного целевого сценария и нового `.env.example`. В рамках этого аудита источником решения считается уточнение владельца продукта: основной профиль — `real/real/real`.

Даже при правильных env-переменных пользовательский путь нельзя считать подтверждённым без живого end-to-end smoke со стендом.

## Моки, которые попадают в реальный runtime

### 0. Composition root всегда создаёт mock runtime

Файл: `src/services/ServiceAdaptersContext.tsx:4-8,28-29`.

При каждом старте приложения создаются `MockStorage` и `MockRuntime`, независимо от значений `VITE_*_SOURCE`. Из-за статических импортов все mock adapters и их transitive fixtures также доступны bundler graph целевой сборки. В `real/real/real` mock-клиенты не выбираются и `MockStorage` не читает/не пишет localStorage, пока его методы не вызваны, но сам mock runtime всё равно существует.

Это не приводит к подмене сетевых данных, однако противоречит строгому требованию «полностью real» на уровне composition/bundle. Создание mock-зависимостей должно быть условным или вынесенным из real composition; окончательный production bundle следует отдельно проверить на отсутствие mock-модулей.

### 1. Реальный каталог смешивается с `trainingCases`

Файлы:

- `src/services/real/backendNegotiationClient.ts:23,67-91`;
- `src/mocks/cases.ts`.

`BackendNegotiationClient.mapCase()` получает основные поля кейса с backend, но затем ищет кейс из `trainingCases` по нормализованному заголовку. Из mock-кейса берутся:

- `roleSummaries`;
- `accent`;
- `icon`.

Если имя не совпало, frontend подставляет универсальные описания ролей и циклически назначает цвет/иконку по позиции в серверном массиве. Поэтому изменение порядка кейсов на backend меняет оформление, а одинаковое имя неявно связывает серверную сущность с локальным fixture. Это реальная mock-зависимость, а не только демонстрационный профиль.

Что можно заменить сейчас:

- основные поля кейса уже приходят с `GET /v1/chats/cases`;
- `goal` тоже уже приходит, но frontend его отбрасывает;
- безопасного поля для публичного краткого описания каждой роли, `accent`, `icon` или artwork в контракте нет.

### 2. Arena повторно ищет реальный кейс в локальном каталоге

Файл: `src/pages/ArenaPage.tsx:16-38,63-67,172`.

После `GET /v1/chats/{uuid}` adapter уже получает вложенный серверный кейс, но `NegotiationSession` сохраняет лишь `caseId`, имя и лимит времени. Arena затем снова ищет карточку в `trainingCases` по mock-id или названию. Возможные эффекты:

- серверный кейс с новым названием превращается в generic `fallbackCase()`;
- кейс с тем же названием получает локальные описание, категорию, сложность, оппонента, роли, цвет и иконку, даже если backend уже изменён;
- fallback выдумывает категорию «Карьера», сложность `moderate`, роли «Участник» / «AI-оппонент», `violet` и `dialogue`;
- для совпавшего по имени кейса реальный экран может показывать устаревшие mock-данные.

Это можно устранить на текущем контракте для названия, описания, категории, сложности, времени, цели и названий ролей: все они есть во вложенном `case`. Визуальная тема и публичные role summaries потребуют frontend-only правила либо расширения API.

### 3. `duelPreparation` показывается и в real voice

Файлы:

- `src/pages/ArenaPage.tsx:17,172`;
- `src/components/arena/DuelPreparation.tsx:22,30-38`;
- `src/mocks/duelPreparation.ts`.

Для шести mock-кейсов жёстко заданы цель, три границы торга, BATNA и четыре шага сценария. Если owner-scoped локальный snapshot не найден, Arena показывает этот fixture даже при `isRealVoice=true`, лишь добавляя примечание о демо.

Backend уже возвращает:

- `case.goal`;
- `chat.preparations` — Markdown, отправленный при создании чата;
- `chat.selected_role`;
- названия обеих ролей во вложенном `case`.

Значит цель, выбранную роль, роли участников и фактически отправленную подготовку можно брать с сервера уже сейчас. Три границы торга, BATNA и шаги не являются отдельными серверными полями; они доступны только внутри пользовательского `preparations` либо скрытых role preparations. Для восстановления исходной структуры формы из Markdown нужен стабильный структурированный контракт или сохранение JSON, иначе возможно только безопасное отображение текста целиком.

Примечание в `DuelPreparation` о том, что AI «пока не получает роль и сценарий кейса», устарело для текущего audio-engine: он получает активный чат, роли, `system_prompt`, описание кейса и role preparation при установке WebSocket-сессии.

### 4. Локальная подготовка считается источником истины после создания реального чата

Файлы:

- `src/features/preparation/preparation.ts:107-163`;
- `src/features/preparation/useStartNegotiation.ts`;
- `src/pages/ArenaPage.tsx:66`.

Черновик и snapshot сохраняются в owner-scoped `localStorage`. Это оправдано для незавершённого черновика, но после создания real-чата сервер уже хранит сериализованную подготовку и выбранную роль. Arena всё равно отображает локальный snapshot, а не `session.preparations`.

Следствия:

- другой браузер/устройство видит серверный чат, но не видит подготовку в UI;
- очистка localStorage включает mock-fallback вместо серверного текста;
- серверный `selected_role` не используется для восстановления подписей участников;
- данные дублируются и могут разойтись.

Сейчас можно оставить локальным только draft до создания чата, а созданную сессию восстанавливать из backend. Для полного редактируемого восстановления нужен структурированный формат вместо единственной Markdown-строки.

### 5. Результат real-сессии не использует mock-анализ, но роли остаются заглушками

Файлы:

- `src/pages/ResultPage.tsx:11,32`;
- `src/components/result/ResultAnalysis.tsx:24-25`.

Положительный момент: `getDuelPreparation()` передаётся в результат только при `result.source === 'mock'`; server evaluation не смешивается с `resultAnalysis`.

Но для server result `preparation=null`, поэтому шапка результата всегда показывает «Участник → AI-оппонент», хотя `selected_role` и роли кейса доступны через `GET /v1/chats/{uuid}`. Это не mock-результат, но реальная жёсткая заглушка, которую контракт уже позволяет убрать.

### 6. Статическая графика кейсов привязана к mock slug

Файлы:

- `src/mocks/caseArtwork.ts`;
- `src/components/home/HomeDashboardSections.tsx:6,47`.

Artwork сопоставлен шести строковым mock-id (`salary-review`, `refund` и т. п.). Реальные кейсы имеют UUID, поэтому сопоставление обычно не срабатывает и используется общий hero. Поля изображения в backend нет. Удалить это соответствие можно, но заменить серверным artwork сейчас нельзя.

## Оставшиеся demo/test-моки вне целевого сценария

Эти реализации не должны обслуживать целевой пользовательский путь. Сейчас real adapters выбираются корректно, но из-за безусловных imports/создания `MockRuntime` нельзя утверждать, что весь mock-код изолирован от целевой сборки. Если автономный demo/test-профиль нужен, его следует отделить от real composition. Если не нужен — это кандидаты на удаление после переноса необходимых тестовых fixtures в тестовый контур.

| Область | Файлы | Что имитируется |
| --- | --- | --- |
| Auth | `src/services/mock/mockAuthClient.ts`, `mockStorage.ts` | пользователи, пароли, activation link, refresh tokens, TOTP с фиксированным secret `JBSWY3DPEHPK3PXP` |
| Каталог | `src/mocks/cases.ts` | 6 кейсов со всеми описаниями, ролями, сложностью и временем |
| Чаты | `src/services/mock/mockNegotiationClient.ts`, `mockRuntime.ts` | создание/история/статусы/сообщения в localStorage |
| Текстовый AI | `src/mocks/negotiation-scenarios.ts` | первая user-реплика и по 3 циклических ответа AI на каждый кейс |
| Голос | `src/services/mock/mockAudioClient.ts` | fake ticket, печатающийся транскрипт и синус 440 Hz вместо TTS |
| Результат | `src/mocks/resultAnalysis.ts`, `resultFixtures.ts` | исход по числу user turns, три судьи, coach, plan-vs-reality и рекомендации |
| Подготовка кейса | `src/mocks/duelPreparation.ts` | цель, границы, BATNA и план каждого mock-кейса |
| Хранение | `src/services/mock/mockStorage.ts` | browser DB пользователей, сессий, результатов и tickets |

Особенности mock-логики, которые нельзя переносить в real-сценарий:

- `>= 2` пользовательских реплик всегда дают `agreement`, иначе `no-agreement`;
- ответы AI циклически повторяются;
- mock voice не использует фактический звук пользователя;
- TOTP принимает любой шестизначный код после enrollment;
- результат содержит заранее написанные наблюдения и рекомендации, лишь подставляя отдельные цитаты.

### Неиспользуемые fixtures

- `recentTrainings` в `src/mocks/cases.ts:101-105` нигде не импортируется.
- `caseCategories` в `src/mocks/cases.ts:12` нигде не импортируется.
- `TrainingHistoryItem` в `src/types/case.ts` существует только ради неиспользуемого `recentTrainings`.
- `createMockResultStateFixtures()` и `mockOutcomeFixtureKinds` используются как fixture API, но runtime вызывает только `createMockResultFixture()`; прямых импортов первых двух в `src/` нет.

## Жёстко заданные продуктовые данные вне папки mocks

### Профиль и геймификация

| Данные | Место | Реальный источник сейчас |
| --- | --- | --- |
| Имя «Кирилл» | `src/pages/HomePage.tsx:42`, `src/components/chrome/ProfileMenu.tsx:82` | Нет. Backend хранит имя/фамилию при регистрации, но не имеет `/me` и не возвращает профиль в tokens/login. |
| «Демо-профиль» | `src/components/chrome/ProfileMenu.tsx:82` | Нет; это явная статическая подпись. |
| Серия 4 дня | `HomePage.tsx:38`, `ArenaHeader.tsx:37`, `ResultHeader.tsx:4`, `HomeDashboardSections.tsx:60` | Нет endpoint статистики. |
| Уровень 4, 720 / 900 XP | `HomeDashboardSections.tsx:59` | Нет endpoint XP/уровней. |
| Прогресс подготовки 65% | `HomeDashboardSections.tsx:51` | Backend не считает процент. Локально его можно вычислить из draft через `completedPreparationSteps()`, но для активной серверной сессии структурированный draft не гарантирован. |
| «Отличная динамика!» | `HomeDashboardSections.tsx:60` | Нет аналитики динамики. |
| Аватар пользователя | `src/assets/home/profile.webp` во всех product screens | Нет profile/avatar API. |

Из перечисленного только процент подготовки можно заменить локально вычисляемым фактом без backend. Имя можно было бы сохранять после регистрации лишь как частичный workaround: login на другом устройстве всё равно не восстановит его. Для корректного решения нужен profile endpoint либо необходимые claims в access token, явно закреплённые контрактом.

### Рекомендация и история

- `src/pages/HomePage.tsx:24`: «рекомендуемый» кейс — всегда `dashboard.cases[0]`. Это не рекомендация сервиса.
- `HomeDashboardSections.tsx:45`: подпись «Рекомендуем» поэтому вводит в заблуждение.
- число тренировок реально вычисляется из `listSessions()` и уже не является mock.
- score в `NegotiationSessionSummary` предусмотрен frontend-типом, но backend list/detail не возвращает числовую оценку; UI поэтому может показать только status/victory/defeat.
- backend `GET /v1/chats/` отдаёт только `uuid`, `name`, `selected_role`. Frontend делает до четырёх параллельных `GET /v1/chats/{uuid}` для заполнения истории. Это реальные данные, но N+1 является следствием узкого list-контракта.
- `mapSummary()` в `backendNegotiationClient.ts:95-105` записывает `caseId: chat.name`, а не `chat.case.id`. Из-за этого `HomePage.tsx:27` часто не находит кейс активной сессии по id и может показать первый/«рекомендуемый» кейс вместо активного. Это не mock как таковой, но усиливает видимость фиктивных данных.
- `GET /v1/chats/active` уже существует и может дать точный активный чат, но frontend его не использует.

### Визуальные и контентные справочники

Это жёстко заданные данные, но не обязательно моки. Они являются frontend-контентом/дизайн-системой и не имеют ожидаемого серверного источника:

- подписи и уровни сложности в `src/types/case.ts`;
- цвета и иконки кейсов в `backendNegotiationClient.ts` и `caseArtwork.ts`;
- структура формы подготовки, 10 шагов, 8 слоёв, SWOT и грани торга в `src/features/preparation/metadata.ts` и тексты полей в `PreparationForm.tsx`;
- сценарий product tour в `src/features/product-tour/productTourSteps.tsx`;
- названия, вопросы и изображения трёх коллегий судей, подписи outcome/goal/plan в `src/components/result/ResultSections.tsx`;
- весь marketing-контент landing: `LandingPage.tsx`, `LandingHeader.tsx`, `ProblemSection.tsx`, `HowItWorksSection.tsx`, `AiOpponentSection.tsx`, `TeamsSection.tsx`, `CaseSettingsPreview.tsx`;
- fallback-тексты ошибок, empty states, placeholders и подписи элементов управления по страницам/компонентам.

Их не следует механически переносить на backend. Если нужен CMS/локализация/удалённая конфигурация, это отдельная продуктовая задача, которой в текущих контрактах нет.

### Технические константы — не моки данных

Следующие значения жёстко заданы, но отражают protocol/UI policy, а не вымышленные продуктовые данные:

- PCM `24000 Hz`, mono, 16-bit в `src/types/audio.ts` — совпадает с audio-engine contract;
- evaluation contract `2.0.0-rc.1` и enum-валидация в `targetContract.ts`;
- timeout/polling/retry значения, voice meter thresholds и animation timings;
- storage keys и версии schema;
- маппинг server enum → русские UI labels.

Удалять их вместе с моками не нужно; при изменении wire-контракта их следует обновлять синхронно.

## Что уже можно заменить реальными данными

| Frontend-данные/поведение | Реальный источник | Состояние сейчас | Вывод |
| --- | --- | --- | --- |
| Регистрация, активация, login, refresh, logout, TOTP | `/v1/auth/*` | Реализовано real adapter | В целевом сценарии MockAuth не нужен. |
| Каталог: id, название, описание, категория, сложность, лимит, synopsis, роли | `GET /v1/chats/cases` | Реализовано, кроме части полей | Уже реально. Убрать смешивание с `trainingCases`. |
| Цель кейса | `CaseResponse.goal` | Парсер её отбрасывает | Можно заменить mock goal сейчас. |
| Создание чата, роль, подготовка | `POST /v1/chats/` | Реализовано | Уже реально; `clientCommandId` backend не принимает, поэтому idempotency создания на сервере нет. |
| Роль и подготовка при повторном открытии | `GET /v1/chats/{uuid}` → `selected_role`, `preparations`, `case` | Данные загружаются, UI опирается на local snapshot/mock | Можно заменить сейчас. |
| Активный чат | `GET /v1/chats/active` | Frontend использует общий список | Можно использовать сейчас. |
| История чатов | `GET /v1/chats/` + detail | Реализовано через N+1 | Данные реальные; list schema стоит расширить для эффективности. |
| Голосовой AI | `PUT /v1/chats/active` + `/v1/audio-stream?token=...` | Реализовано | Можно использовать в `real/real/real`; ticket не нужен. |
| User/AI transcript | audio-engine transcript events + backend messages | Реализовано с reconciliation | Реально. Audio-engine сохраняет обе стороны через message endpoint. |
| Завершение и анализ | `POST .../evaluate`, `GET .../result` | Реализовано и строго валидируется | Mock result не нужен в real profile. |
| Полный транскрипт результата | `GET /v1/chats/{uuid}` | Реализовано | Реально. |
| Повтор кейса | новый `POST /v1/chats/` с предыдущими case/role/preparations | Реализовано | Реально, если исходная сессия загрузилась полностью. |
| Отображаемая длительность завершённой сессии | — | Backend не возвращает `finished_at`; frontend duration часто отсутствует | Нужен контракт времени завершения либо вычисление/фиксация другого события. |

## Что нельзя заменить текущими сервисами

### Профиль пользователя

Auth backend принимает `first_name`/`last_name` при регистрации, но `AuthTokens` содержит только access/refresh, JWT payload — `sub`, `iat`, `exp`, а profile endpoint отсутствует. Поэтому имя, фамилию, email, avatar и подпись профиля после обычного login получить нельзя.

### Геймификация и персонализация

Нет контрактов для streak, XP, level, прогресса навыков, динамики, рекомендаций кейса или агрегированной статистики. Эти блоки нельзя сделать реальными на существующих запросах. Число чатов можно посчитать, но это не заменяет остальные показатели.

### Числовой score

Evaluation contract возвращает outcome, judges и trainer, но не итоговый балл `0..100`. Поле `score?` во frontend summary не имеет источника.

### Полноценный текстовый AI-режим

`POST /v1/chats/{chat_uuid}/message/` принимает `{text, is_ai}` и лишь сохраняет сообщение. Он не отправляет user text в AI и не возвращает парный AI response. Browser не должен сам посылать `is_ai=true`. Поэтому этот endpoint может заменить только persistence, но не `getMockAiResponse()`.

### Artwork и безопасные role summaries

В CaseResponse нет image/artwork/accent/icon и отдельного публичного описания каждой роли. `first_role_preparations`, `second_role_preparations` и `system_prompt` нельзя автоматически показывать в карточке: они содержат сценарный контекст и могут раскрыть скрытую позицию.

### Структурированная подготовка

Backend хранит одну строку `preparations` длиной до 10 000 символов. Поля формы, процент заполнения и черновое редактирование нельзя надёжно восстановить как структуру без версионированного JSON-контракта или отдельного ресурса draft.

## Расхождения frontend с текущим контрактом

1. `CaseResponse` требует `goal`, `system_prompt`, `first_role_preparations`, `second_role_preparations`, но `ParsedCase` сохраняет только часть ответа. `goal` теряется полностью; role preparations лишь валидируются; `system_prompt` даже не описан в frontend DTO. Парсер допускает лишние поля, поэтому запрос не падает, но тип не отражает реальный wire contract.
2. `ChatListItem` содержит `selected_role`, frontend `ChatListItemDto`/`ParsedChatListItem` его отбрасывает.
3. Detail chat содержит case UUID, но `mapSummary()` присваивает `caseId=chat.name`.
4. `NegotiationSession` уже содержит `selectedRole` и `preparations`, однако Arena/Result не используют их как источник восстановления ролей и подготовки.
5. Backend create/message schemas не имеют `clientCommandId`/`clientTurnId`. Защита mock runtime от дублей не переносится на real backend. Повтор после неопределённого сетевого результата может создать второй чат или второе сообщение, если эти операции будут подключены напрямую.
6. Backend не возвращает `finished_at`; frontend model его ожидает опционально. Поэтому реальная длительность результата не вычисляется.
7. Документация frontend утверждает, что text turn отсутствует, хотя в свежем OpenAPI есть message CRUD. Утверждение всё ещё верно в смысле AI-хода, но его следует формулировать точнее: persistence endpoint есть, AI text generation отсутствует.

## Security-наблюдение по контракту кейсов

`GET /v1/chats/cases` и вложенный `case` в chat detail возвращают:

- `system_prompt`;
- `first_role_preparations`;
- `second_role_preparations`.

Endpoint каталога доступен любому авторизованному пользователю. Frontend намеренно не экспонирует эти значения, что правильно для текущей модели скрытой позиции. Перед использованием role preparations вместо mock `roleSummaries` нужно определить, какие сведения публичны игроку, а какие должен видеть только audio-engine. Предпочтительнее отдельные публичные поля `first_role_summary` / `second_role_summary` и server-to-server доступ к скрытым инструкциям, а не повторное использование секретных prompt-полей в UI.

## Рекомендуемая последовательность удаления моков

Это не план выполненных изменений, а порядок, минимизирующий продуктовый риск.

1. Подтвердить целевой `real/real/real` живым voice E2E; не использовать mock-профиль как критерий готовности.
2. Убрать безусловное создание mock storage/runtime и проверить, что mock-модули не входят в целевую production-сборку.
3. Убрать `trainingCases` из real adapter и передавать полный безопасный case view из server response в Arena/Result.
4. Восстанавливать роли, цель и отправленную подготовку из chat detail; оставить localStorage только для черновика до создания.
5. Исправить identity кейса в history (`case.id`, не `chat.name`) и использовать active-chat endpoint либо расширенный list response.
6. Удалить или явно скрыть неподтверждённые блоки имени, streak, XP, level, progress и recommendation до появления контрактов.
7. Если demo/test-профиль сохраняется, физически отделить его adapters/fixtures от real composition. Не смешивать fixtures с real adapter.
8. Текстовый demo не объявлять real-функцией, пока сервис не предоставит AI text turn с серверной авторизацией, persistence и idempotency.
9. Согласовать безопасный публичный case DTO: role summaries и media metadata; перестать отдавать browser-клиенту скрытые prompts, если они действительно секретны.

## Критерий завершения будущей работы

Моки можно считать удалёнными из реального сценария, когда одновременно выполнены условия:

- production composition root не создаёт mock runtime и mock adapters;
- ни один файл `src/services/real`, real page path или real feature hook не импортирует `src/mocks/*`;
- Arena и Result восстанавливаются после входа на другом устройстве только из backend/audio данных;
- UI не показывает персональные цифры и имя без подтверждённого источника;
- новый/переименованный backend-кейс корректно работает без совпадения с локальным названием или slug;
- реальный результат содержит только server evaluation и server transcript;
- voice-сценарий проверен end-to-end, включая reconnect, сохранение обеих реплик и evaluation;
- text mode либо скрыт в real profile, либо обеспечен отдельным реальным AI-контрактом.
