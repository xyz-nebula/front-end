# Отделение mock-режима от real-сценария

## Цель

Целевой пользовательский сценарий должен работать только с реальными сервисами:

- auth — backend;
- каталог, чаты, история и evaluation — backend;
- голосовой AI — audio-engine.

Mock-режим сохраняется для demo/test, но не должен создавать данные, подмешивать fixtures или менять поведение real-сценария.

Источники аудита:

- frontend `src/`;
- <https://nebula.tx0.su/api/openapi.json>;
- `C:\Users\user\UrFU\coolname\backend`;
- `C:\Users\user\UrFU\coolname\audio-engine`.

## Зафиксированные решения

1. Поддерживаются только два режима: `real` и `mock`.
2. Три `VITE_*_SOURCE` заменяются одной обязательной переменной:

   ```dotenv
   VITE_SERVICE_MODE=real
   ```

3. Старые `VITE_AUTH_SOURCE`, `VITE_NEGOTIATION_SOURCE`, `VITE_AUDIO_SOURCE` удаляются без обратной совместимости.
4. В `real` mock storage/runtime/clients не создаются и не используются. Их присутствие в общем bundle допустимо.
5. В `mock` не выполняются запросы к backend или audio-engine.
6. Text mode доступен только в `mock`; real поддерживает только voice.
7. Отображаемая подготовка хранится в owner-scoped `localStorage`. Backend `preparations` предназначен для AI и не парсится frontend.
8. Если локальной подготовки нет, показывается «Подготовка недоступна на этом устройстве» без mock/server fallback.
9. Backend предоставляет содержание кейса; frontend может добавлять только presentation metadata: artwork, icon, accent и текущие UI-подписи.
10. Текущие «Кирилл», streak, XP/level, 65% подготовки и рекомендация первого кейса пока остаются без изменений.

## Что сейчас нарушает разделение

### Composition root

`src/services/ServiceAdaptersContext.tsx` всегда создаёт `MockStorage` и `MockRuntime`, даже если выбраны все real adapters. Три источника можно независимо смешивать.

### Real adapter зависит от fixtures

`src/services/real/backendNegotiationClient.ts` импортирует `trainingCases` из `src/mocks/cases.ts`. Из fixture по названию кейса берутся `roleSummaries`, `accent` и `icon`.

### Real Arena использует mock-кейсы

`src/pages/ArenaPage.tsx` повторно ищет серверную сессию в `trainingCases`, использует `getDuelPreparation()` и создаёт вымышленный `fallbackCase()`. Новый или переименованный backend-кейс получает устаревшие либо generic данные.

### Отсутствие localStorage включает demo fallback

При отсутствии локального snapshot real Arena показывает `duelPreparation`. Backend `preparations` нельзя использовать вместо snapshot: это непрозрачная строка для AI.

### Real Result теряет роли

Server evaluation не подменяется mock-анализом, но `ResultAnalysis` показывает «Участник → AI-оппонент», потому что real case/selected role не доходят до компонента.

### Text mode можно открыть в real

Прямой `?mode=text` позволяет создать сессию, после чего `BackendNegotiationClient.sendTextTurn()` закономерно возвращает `featureUnavailable`. Backend message endpoint только сохраняет сообщения и не генерирует AI-ответ.

### Ошибка identity в истории

`backendNegotiationClient.mapSummary()` записывает `caseId: chat.name`. Из-за этого активная сессия может показывать первый кейс каталога вместо своего. Identity real-кейса должна быть UUID.

## Что уже доступно от сервисов

Можно использовать без нового backend API:

- auth/TOTP — `/v1/auth/*`;
- каталог — `GET /v1/chats/cases`;
- создание чата с ролью и AI preparation — `POST /v1/chats/`;
- session/case/messages — `GET /v1/chats/{uuid}`;
- активный чат — `GET /v1/chats/active`;
- история — `GET /v1/chats/` с detail-запросами;
- voice AI — `PUT /v1/chats/active` и `/v1/audio-stream`;
- transcript persistence — audio-engine через backend message endpoint;
- evaluation — `POST .../evaluate` и `GET .../result`.

Текущий API не предоставляет профиль пользователя, streak, XP, level, recommendation, score, artwork/icon/accent или публичные role summaries. Эти UI-данные не нужно выдавать за ответы backend.

`system_prompt`, `first_role_preparations` и `second_role_preparations` нельзя передавать в UI: это скрытый сценарный контекст. Желательно отдельно исправить backend-контракт, который сейчас возвращает их browser-клиенту.

## План изменений

### 1. Ввести единый режим

Файлы:

- `src/services/config.ts`;
- `src/services/ServiceAdaptersContext.tsx`;
- `src/services/serviceAdapters.ts`;
- `.env.example`, Vite/Playwright helpers и документация.

Действия:

- добавить `ServiceMode = 'real' | 'mock'` и `VITE_SERVICE_MODE`;
- удалить три `VITE_*_SOURCE`, `ServiceSource` и гибридные конфигурации;
- неизвестное/пустое значение считать ошибкой конфигурации;
- добавить capability `supportsTextNegotiation`: `false` для real, `true` для mock.

Проверка: приложение невозможно запустить в гибридном режиме.

### 2. Разделить создание adapters

В `ServiceAdaptersContext.tsx` создавать атомарно один suite:

- `real`: `BackendAuthClient`, `BackendNegotiationClient`, `AudioEngineClient`;
- `mock`: единые `MockStorage`/`MockRuntime` и три mock clients.

`MockStorage` и `MockRuntime` должны создаваться только внутри ветки `mock`.

Проверки:

- real не создаёт mock-классы;
- mock не вызывает `fetch` и WebSocket;
- оба режима проходят собственный smoke.

### 3. Вынести presentation metadata из mocks

Файлы:

- новый `src/features/cases/casePresentation.ts`;
- `src/mocks/cases.ts`, `src/mocks/caseArtwork.ts`;
- `src/services/real/backendNegotiationClient.ts`;
- `src/types/case.ts` и home-компоненты.

Действия:

- оставить в `src/mocks/cases.ts` только полный mock-каталог;
- перенести artwork/icon/accent/оставленные UI-подписи в presentation registry;
- удалить import `trainingCases` из real adapter;
- server title/description/roles/difficulty/time/goal никогда не заменять fixtures;
- неизвестному server case назначать стабильное generic-оформление, не зависящее от индекса.

Проверка: новый backend-кейс работает без локального fixture; изменение mock-кейса не влияет на real.

### 4. Передать безопасный server case в Arena и Result

Файлы:

- `src/services/real/targetContract.ts`;
- `src/services/real/backendNegotiationClient.ts`;
- `src/types/negotiation.ts`;
- `src/pages/ArenaPage.tsx`, `ResultPage.tsx`;
- `src/components/result/ResultAnalysis.tsx`.

Действия:

- добавить `goal` и безопасный case snapshot в domain model;
- сохранить case UUID, title, description, time limit и обе роли;
- исключить `system_prompt` и role preparations из UI/domain model;
- удалить поиск в `trainingCases` и `fallbackCase()`;
- вычислять user/opponent role по `selectedRole`;
- передавать реальные роли в Result.

Проверка: неизвестный frontend кейс корректно открывается в Home, Arena и Result.

### 5. Изолировать preparation

Файлы:

- `src/features/preparation/preparation.ts`;
- `src/pages/ArenaPage.tsx`;
- `src/components/arena/DuelPreparation.tsx`;
- `src/mocks/duelPreparation.ts`;
- общие result-типы/props.

Действия:

- сохранить owner-scoped localStorage draft/snapshot;
- real Arena показывает только локальный snapshot;
- при его отсутствии показывать нейтральное состояние;
- запретить fallback на `getDuelPreparation()`, `session.preparations` и role preparations;
- оставить `duelPreparation.ts` только в mock-flow;
- убрать mock-типы из общих компонентов.

Проверки: real без localStorage не показывает demo; данные одного owner недоступны другому.

### 6. Заблокировать text в real

Файлы:

- `src/pages/PreparationPage.tsx`;
- `src/features/preparation/useStartNegotiation.ts`;
- `src/pages/ArenaPage.tsx`;
- capability из шага 1.

Действия:

- direct URL `?mode=text` в real не должен создавать чат;
- показывать понятное состояние недоступности и ссылку к кейсам;
- добавить guard в `useStartNegotiation`;
- ранее созданная text-сессия не должна показывать рабочий composer в real;
- mock text flow оставить без изменений.

Проверка: real никогда не вызывает `createSession(mode='text')` или `sendTextTurn()`.

### 7. Исправить историю и результат

Файлы:

- `src/services/real/backendNegotiationClient.ts`;
- `src/features/home/useHomeDashboardData.ts`;
- `src/pages/HomePage.tsx`;
- result hooks/pages.

Действия:

- использовать `chat.case.id` как `caseId`;
- использовать `GET /v1/chats/active` либо корректные details для active session;
- не связывать кейсы по title как identity;
- не придумывать `score`;
- server evaluation failure не заменять mock result;
- mock result generator оставить только в mock suite.

Проверки: active session показывает свой кейс; в real невозможно получить `result.source='mock'`.

### 8. Удалить мёртвые данные и закрепить границы

После переноса presentation metadata:

- удалить неиспользуемые `recentTrainings`, `caseCategories`, `TrainingHistoryItem`;
- перенести чисто тестовые fixtures в `tests/fixtures`, если они больше не нужны mock runtime;
- добавить ESLint `no-restricted-imports`: real adapters/pages/features не импортируют `@/mocks/*`;
- разрешить mock imports только mock suite и тестам.

Проверка:

```text
rg "@/mocks" src/services/real src/pages src/features
```

не находит нарушений.

### 9. Обновить документацию и тесты

Обновить:

- `README.md`;
- `docs/architecture.md`;
- `docs/contracts.md`;
- `docs/deployment-and-integrations.md`;
- `docs/testing.md`;
- `.env.example` и visual test docs/scripts.

Документация должна описывать:

- только `VITE_SERVICE_MODE=real|mock`;
- real как основной режим;
- voice-only в real и text+voice demo в mock;
- localStorage как источник отображаемой подготовки;
- отсутствие server fallback на mock.

Обязательные проверки:

1. `npm run check`.
2. `npm run visual:smoke` и ручной просмотр затронутых desktop/mobile PNG.
3. Mock smoke без доступных backend/audio-engine.
4. Живой real smoke: auth → cases → preparation → create → activate → voice → transcript → finish → evaluation → result.

## Готово, когда

- существует только `VITE_SERVICE_MODE=real|mock`;
- real не создаёт и не использует mock runtime/clients;
- mock не обращается к реальным сервисам;
- real-код не импортирует `src/mocks/*`;
- содержание real-кейса приходит только с backend;
- frontend-only оформление находится в presentation-слое;
- real Arena использует server case/role и локальный preparation snapshot;
- отсутствие snapshot не включает demo fallback;
- text полностью заблокирован в real;
- UUID является identity real-кейса;
- real Result не делает fallback на mock analysis;
- оба режима покрыты smoke-тестами, а документация соответствует коду.
