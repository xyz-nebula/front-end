# Code review PR `new-design` → `dev`

Дата ревью: 27 сентября 2026 г.  
Ревьюерская позиция: независимое pre-merge review frontend, включая изменения UI, маршрутов, auth, mock/real negotiation adapters, audio, тестов и performance tooling.

## Итог

**Вердикт: PR пока не готов к merge.**

Код в целом написан аккуратно: TypeScript строгий, `any` не добавлен, сервисные границы в основном сохранены, крупные маршруты лениво загружаются, новые состояния имеют заметно лучшее тестовое покрытие, production build проходит. Но перед merge остаются блокирующие проблемы:

1. Контракт кейсов передаёт в браузер скрытые подготовки обеих ролей. Это нельзя считать защищёнными данными: пользователь увидит их в Network/DevTools.
2. Выбранная пользователем роль не передаётся при создании backend-сессии. UI обещает сценарий выбранной стороны, но backend не получает достаточно данных для этого.
3. `npm run check` нестабилен: новый тест voice visualization падает воспроизводимо (6 из 10 повторов).
4. PR удаляет Tailwind preflight и MUI `ThemeProvider`/`CssBaseline`, хотя действующая styling policy прямо требует их сохранить и выносить смену подхода в отдельное решение.
5. Один объединённый флаг `isRealVoice` используется сразу как признак negotiation backend, audio backend, доступности режима и необходимости demo-disclaimer. В разрешённых смешанных конфигурациях это приводит к неработающему сценарию и/или показу выдуманного разбора без предупреждения.

Ниже — подробности. Сложность указана как ориентир: **легко** — локальная правка и тест; **средне** — несколько слоёв/сценариев; **сложно** — требуется изменение backend-контракта или продуктового решения.

## Блокирующие замечания

### 1. [P0 / Critical] «Скрытый» сценарий AI фактически раскрывается клиенту

**Где:** `src/services/real/targetContract.ts:18-31`, `src/services/real/targetContract.ts:172-188`, `tests/visual/service-contracts.spec.ts:95-115`  
**Сложность исправления:** сложно (backend + frontend contract)

`CaseResponseDto` содержит одновременно `first_role_preparations` и `second_role_preparations`. Парсер затем намеренно не возвращает эти поля в `ParsedCase`, а тест проверяет, что их нет в итоговом объекте. Но удаление полей после `fetch` не скрывает их от пользователя: исходный JSON уже попал в браузер и доступен в DevTools, прокси, service worker и любом monkey patch для `fetch`.

Для тренажёра переговоров это не просто техническая утечка: пользователь может прочитать позицию и ограничения AI-оппонента до начала раунда, то есть основной сценарий перестаёт быть честным.

**Что исправить:** публичный `GET /v1/chats/cases` не должен отдавать секреты ни одной стороны. После выбора роли backend должен вернуть/привязать только разрешённый пользователю контекст, а подготовку оппонента хранить исключительно серверно. Frontend-тест должен проверять не только mapped object, а отсутствие секретных полей в сетевом DTO.

### 2. [P0 / Critical] Выбранная роль не участвует в создании backend-сессии

**Где:** `src/components/home/TrainingModal.tsx:38-41`, `src/pages/PreparationPage.tsx:195-220`, `src/services/contracts/negotiationClient.ts:10-18`, `src/services/real/targetContract.ts:7`, `src/services/real/targetContract.ts:236-237`  
**Сложность исправления:** сложно (нужно согласовать API), frontend-часть — легко

Роль (`0 | 1`) добавляется в query страницы подготовки и локально сохраняется в snapshot, но `createSession()` отправляет только `case_uuid`, `name` и `preparations`. Backend не узнаёт, какую сторону выбрал пользователь, и не может надёжно назначить противоположную роль AI.

Это расходится с текстом UI: «Вторая роль автоматически станет AI-оппонентом» и «Выбранная роль сохранится в подготовке и поединке». Локальный snapshot меняет только подписи на экране, но не серверное поведение.

**Что исправить:** добавить в контракт явный стабильный идентификатор роли (`role_id`, `role_index` или enum, согласованный с backend), передавать его в `NegotiationClient.createSession`, включать в idempotency context и возвращать назначенные роли в session DTO. Нужен интеграционный тест для обеих ролей, а не только UI-тест выбора radio.

### 3. [P1 / High] `npm run check` нестабилен и сейчас не является надёжным merge gate

**Где:** `tests/visual/arena-audio-resilience.spec.ts:34-48`, `tests/visual/voice-controls-harness.tsx:39-54`, `src/components/arena/VoiceControls.tsx:62-90`  
**Сложность исправления:** легко/средне

Полный `npm run check` упал на ожидании `loudLevel > 0.7`: получено `0.599`. Одиночный повтор прошёл, но серия `--repeat-each=10` дала **6 падений из 10**. Кроме атаки нестабильно проверяется и затухание: встречались `aiLevel` 0.317, 0.342 и 0.73 при ожидании `< 0.3`.

Причина — тест измеряет `requestAnimationFrame`-анимацию фиксированными `setTimeout(350/300 ms)`, а код ограничивает учтённый промежуток одного кадра значением 64 ms. Результат зависит от числа реально отрисованных кадров и загрузки машины.

**Что исправить:** сделать тест детерминированным: управлять RAF/`performance.now`, ждать проверяемого состояния через polling с разумным допуском либо вынести формулу сглаживания в чистую функцию и отдельно тестировать её по заданным timestamp. Не следует просто расширять timeout/порог без фиксации источника недетерминизма.

### 4. [P1 / High, policy blocker] Без отдельного решения удалена утверждённая styling foundation

**Где:** `package.json`, `vite.config.ts`, `src/main.tsx`, удалённые `src/components/layout/AppThemeProvider.tsx` и `src/styles/theme.ts`, `src/styles/global.css:1-33`; правило — `docs/styling.md:25-34`  
**Сложность исправления:** средне

PR удаляет Tailwind, Vite plugin, MUI/Emotion, `ThemeProvider`, `CssBaseline` и заменяет baseline собственным глобальным reset. Действующая политика проекта прямо говорит, что Tailwind остаётся baseline/preflight, MUI остаётся `ThemeProvider`/`CssBaseline`, а смена подхода требует отдельного явного решения.

Проблема не в том, что plain CSS хуже — новые semantic scoped-классы как раз соответствуют политике. Проблема в скрытой архитектурной миграции внутри дизайн-PR. Она увеличивает blast radius на все экраны и создаёт два источника reset-поведения: исторические ожидания компонентов и новый ручной reset.

**Что исправить:** либо восстановить текущую foundation в этом PR, либо оформить и согласовать отдельное архитектурное решение, обновить `docs/styling.md` и проверить все существующие экраны. До такого решения это формальный merge blocker.

### 5. [P1 / High] `isRealVoice` смешивает четыре разные capability и ломает hybrid-конфигурации

**Где:** `src/services/DomainServicesContext.tsx:10-15`, `src/components/home/TrainingModal.tsx:19-20,113-117`, `src/pages/ResultPage.tsx:23,113-118`, `src/components/result/ResultAnalysis.tsx:92-99`, `src/services/real/backendNegotiationClient.ts:212-225`  
**Сложность исправления:** средне

`isRealVoice` равен `negotiationSource === 'real' && audioSource === 'real'`. Затем он используется для:

- выбора default mode и скрытия текстового режима;
- маркировки voice как demo/real;
- решения, показывать ли disclaimer у результата;
- косвенного предположения, что negotiation backend настоящий.

Конфигурация источников при этом независимая. Например, при `negotiation=real`, `audio=mock` UI показывает текстовый режим и по умолчанию выбирает его, хотя real client не реализует `sendTextTurn`; созданная real-сессия дополнительно всегда маппится как `mode: 'voice'`. В том же режиме `ResultAnalysis` может сгенерировать mock-анализ через `createMockResultAnalysis`, но `isDemo` будет `false`, и пользователь не увидит предупреждения.

**Что исправить:** передавать отдельные capabilities/metadata: `negotiationSource`, `audioSource`, `supportsText`, `supportsVoice`, `resultOrigin`. UI должен показывать только реально поддерживаемые комбинации, а demo-disclaimer должен зависеть от происхождения результата, не от аудиотранспорта. Добавить matrix tests хотя бы для `mock/mock`, `real/real`, `real/mock`.

## Ошибки логики и данных

### 6. [P1 / High] На результате показывается не выбранная пользователем роль

**Где:** `src/pages/ResultPage.tsx:78-92,112-118`, `src/components/result/ResultAnalysis.tsx:93-98`  
**Сложность исправления:** легко

Арена читает `readSessionPreparation(session.id)` и корректно показывает сохранённые `userRole`/`opponentRole`. Result page читает тот же snapshot только внутри `repeatCase`, а для заголовка передаёт `getDuelPreparation(session.caseId)` — статический mock, где всегда зафиксирована первая роль.

Если пользователь выбрал вторую роль, разбор всё равно подпишет его первой. Для backend UUID `getDuelPreparation` вообще вернёт `null`, и заголовок станет «Участник → AI-оппонент».

**Что исправить:** прочитать session snapshot при рендере результата и использовать его роли с приоритетом над static mock. Добавить тест: выбрать вторую роль → завершить раунд → проверить обе подписи на result page и после reload.

### 7. [P1 / High] Подготовка хранится без user scope и может перейти к другому аккаунту

**Где:** `src/features/preparation/preparation.ts:107-145`  
**Сложность исправления:** средне

Ключ черновика состоит только из `caseId + roleIndex`, а snapshot — только из `sessionId`. Данные не связаны с текущим auth owner и не очищаются при logout. На общем браузере следующий пользователь увидит стратегию предыдущего пользователя для того же кейса. В подготовке могут находиться чувствительные коммерческие условия, BATNA и красные линии.

**Что исправить:** namespace storage по стабильному user/owner key и предусмотреть миграцию/очистку при logout или смене сессии. Для memory-session fallback нужен такой же принцип изоляции. Добавить cross-account тест.

### 8. [P2 / Medium] Последние изменения черновика теряются при быстром уходе со страницы

**Где:** `src/pages/PreparationPage.tsx:144-151`  
**Сложность исправления:** легко

Autosave отложен на 400 ms, а cleanup только отменяет timer. Если пользователь ввёл текст и сразу нажал «Назад», сменил URL или обновил вкладку, последнее изменение не сохраняется. Текущий тест ждёт статус «Сохранено», поэтому этот сценарий не покрыт.

**Что исправить:** на cleanup синхронно сохранять актуальный draft (через ref), либо сохранять на `pagehide`/navigation и flush перед собственными переходами. Добавить тест с уходом сразу после `fill`, без ожидания 400 ms.

### 9. [P2 / Medium] Значимая часть backend case DTO игнорируется

**Где:** `src/services/real/targetContract.ts:18-31,172-188`, `src/services/real/backendNegotiationClient.ts:71-86`  
**Сложность исправления:** легко, но нужно продуктовое решение

DTO объявляет `goal` и `created_at`, но `parseCase` их даже не валидирует и не переносит. В итоге `DuelPreparation` для real-кейса использует `description` как цель. Это может показывать пользователю не тот смысл, который заложен backend.

**Что исправить:** либо добавить `goal` в `ParsedCase`/`TrainingCase` и явно показать его, либо удалить поле из frontend DTO, если оно действительно не является частью используемого контракта. Контрактные тесты должны ловить расхождение.

### 10. [P2 / Medium] Начальный переход по hash может не сработать после lazy-loading маршрута

**Где:** `src/App.tsx:14-27`  
**Сложность исправления:** легко

`ScrollToLocation` находится вне `Suspense`. При прямом открытии `/#problem` effect может выполниться, пока `LandingPage` ещё не загрузилась; элемента в DOM нет, повторной попытки не будет. Внутренняя навигация уже загруженного landing работает, а deep link — нет.

**Что исправить:** выполнять hash-scroll после commit содержимого маршрута или повторять его после завершения lazy navigation; добавить e2e для прямого открытия URL с hash.

## Accessibility и UX

### 11. [P2 / Medium] Case modal объявлен модальным, но не удерживает фокус и не возвращает его триггеру

**Где:** `src/components/home/TrainingModal.tsx:22-36,77-120`  
**Сложность исправления:** средне

Компонент ставит фокус на close button и блокирует scroll, но `Tab` может уйти на элементы страницы под `aria-modal="true"`; после закрытия фокус не возвращается на карточку кейса. Это особенно заметно для keyboard/screen-reader пользователей.

**Что исправить:** использовать нативный `<dialog>` либо реализовать корректный focus trap, inert background и restore focus. Добавить keyboard test: циклический Tab/Shift+Tab и возврат на исходную карточку после Escape/close.

### 12. [P3 / Low] Кнопка повторной отправки activation-письма выглядит рабочей, но ничего не отправляет

**Где:** `src/pages/ActivatePage.tsx:96,141-151`  
**Сложность исправления:** легко

Нажатие «Отправить повторно» лишь показывает сообщение, что повторная отправка недоступна. Для demo это допустимо, но action label создаёт ложное ожидание и противоречит требованию не оставлять очевидно неработающие элементы.

**Что исправить:** сделать текстовый disabled/status элемент либо явно назвать действие «Почему нельзя отправить повторно». Реальный resend endpoint добавлять без отдельной backend-задачи не нужно.

## Поддерживаемость и качество реализации

### 13. [P2 / Medium] Новые страницы снова становятся монолитными

**Где:** `src/pages/PreparationPage.tsx` (287 строк, большие inline data/JSX blocks), `src/pages/HomePage.tsx` (237 строк), `src/components/result/ResultAnalysis.tsx` (200 строк)  
**Сложность исправления:** средне

Логика загрузки, persistence, навигации, session creation и большой объём разметки находятся в одном компоненте. В `PreparationPage` повторяются массивы field metadata прямо внутри JSX, а desktop/mobile navigation строится одной вложенной функцией. Это пока читаемо, но уже затрудняет unit-тесты и повышает риск конфликтов при следующих изменениях.

**Что улучшить:** вынести metadata полей/секций, `usePreparationDraft`, start-session orchestration и самостоятельные section-компоненты. Не нужно создавать универсальный form framework — достаточно разделить данные, side effects и presentation.

### 14. [P3 / Low] Документация уже расходится с кодом и тестами

**Где:** `docs/routes.md`, `docs/deployment-and-integrations.md`, `tests/visual/README.md`  
**Сложность исправления:** легко

- В таблице маршрутов и SPA fallback отсутствует новый `/cases/:caseId/preparation`.
- `tests/visual/README.md` заявляет 82 сценария (51 + 31), фактический прогон запускает 98 (58 + 40).
- В README тестов сказано, что real domain stubs не делают сеть, но текущие contract tests уже ожидают HTTP для части real negotiation client.

**Что исправить:** обновить route/deployment tables и не хранить вручную числа тестов либо проверять их скриптом.

### 15. [P3 / Low] Новые тесты не проходят отдельный TypeScript typecheck

**Где:** `tsconfig.app.json`, `tests/visual/README.md`  
**Сложность исправления:** легко/средне

`tsc -b` включает только `src`, а сами Playwright specs/harnesses проверяются лишь ESLint и фактическим выполнением. Сейчас все файлы запускаются, но типовая ошибка в редко исполняемой ветке тестового кода может попасть в PR.

**Что улучшить:** добавить `tsconfig.test.json` с `noEmit` и включить его в `typecheck`/`check`, не смешивая browser app types и Node/Playwright globals.

## Неподтверждённые контрактные риски

Актуальную OpenAPI по `https://test-api.nl.tx0.su/openapi.json` во время ревью получить не удалось: DNS-имя не разрешилось и в sandbox, и при разрешённом внешнем запросе. Поэтому следующие изменения обязательно нужно подтвердить у backend-команды перед merge:

- регистрация больше не отправляет `username` (`src/types/auth.ts`, `src/pages/RegisterPage.tsx`);
- появился `GET /v1/chats/cases`;
- `POST /v1/chats/` теперь требует `case_uuid` и `preparations`;
- `time_limit` трактуется как секунды и округляется вверх до минут;
- WebSocket `transcript.text` теперь трактуется как дельта, а не полный snapshot.

Текущие contract tests повторяют frontend-интерфейсы и локальные fixtures, поэтому сами по себе не доказывают совместимость с живым backend. Особенно опасна смена семантики `transcript`: если сервер по-прежнему присылает накопленный текст, frontend будет склеивать дубликаты.

## Что сделано хорошо

- Строгая типизация сохранена; новых `any`, `@ts-ignore` и обходов type system не найдено.
- Production build проходит, route chunks и route-owned CSS действительно разделены.
- Parser boundary в `targetContract.ts` централизован и возвращает typed `ServiceError`, а не пропускает `unknown` глубже в UI.
- Idempotency для создания/повтора сессии продумана лучше среднего: command ID сохраняется между retry и очищается после успеха.
- Async session/audio код содержит generation guards и cleanup, что снижает риск late-update после смены маршрута.
- Новые loading/error/empty состояния в Home, Preparation и Result покрыты интерфейсом и тестами.
- Responsive и reduced-motion сценарии заметно расширены.
- Оптимизация изображений, lazy routes и bundle/runtime budgets — полезные изменения; production bundle собирается в отдельные route chunks.

## Результаты проверок

| Проверка | Результат |
| --- | --- |
| `git diff --check dev...new-design` | прошло, whitespace errors не найдено |
| `npm run typecheck` | прошло |
| `npm run lint` | прошло |
| `npm run build` | прошло; 130 modules transformed |
| полный `npm run check` | **не прошло**: voice visualization test |
| первый e2e group `real/mock/mock` | 58/58 прошло |
| второй e2e group `mock/mock/mock` | 39 прошло, 1 упал |
| точечный повтор упавшего теста | 1/1 прошёл |
| тот же тест `--repeat-each=10` | **4 прошло, 6 упало** |
| `bundle:report`, `performance:smoke` | не были выполнены после build: после серии браузерных процессов Windows sandbox перестал создавать новые процессы (`CreateProcessWithLogonW 1909`) |
| сверка с live OpenAPI | не выполнена: DNS `test-api.nl.tx0.su` не разрешился |

Visual smoke создал диагностические screenshots до падения, но открыть их через sandbox после тестовой серии не удалось по той же системной ошибке создания процесса. Поэтому утверждать, что все новые кадры визуально проверены независимым просмотром, нельзя.

## Краткий список того, что нужно исправить

Список отсортирован сначала по критичности, а внутри близкого приоритета — от более лёгких исправлений к сложным.

1. **[P0, сложно]** Перестать отдавать браузеру `first_role_preparations` и `second_role_preparations`; скрытый сценарий AI должен оставаться на backend.
2. **[P0, сложно]** Передавать выбранную роль в create-session API и возвращать фактически назначенные роли в session DTO.
3. **[P1, легко]** Использовать session preparation snapshot на Result page, чтобы показывать реально выбранную роль.
4. **[P1, легко/средне]** Сделать voice visualization test детерминированным; сейчас он падает в 60% повторов и ломает `npm run check`.
5. **[P1, средне]** Разделить `isRealVoice` на negotiation/audio capabilities и явный `resultOrigin`; закрыть hybrid-config regressions.
6. **[P1, средне]** Изолировать preparation drafts/snapshots по пользователю и исключить утечку между аккаунтами.
7. **[P1, средне]** Восстановить Tailwind/MUI foundation либо отдельно согласовать и документировать её удаление.
8. **[P2, легко]** Flush autosave при уходе со страницы подготовки.
9. **[P2, легко]** Замаппить или осознанно удалить `goal`/`created_at` case DTO; проверить назначение `goal`.
10. **[P2, легко]** Исправить deep-link scroll для lazy landing route.
11. **[P2, средне]** Добавить корректный focus trap/restore focus в case modal.
12. **[P2, средне]** Подтвердить новые auth/chat/audio DTO по живой OpenAPI и добавить contract fixtures, полученные от backend.
13. **[P2, средне]** Декомпозировать Preparation/Home/Result на data hooks и небольшие presentation-компоненты.
14. **[P3, легко]** Обновить routes/deployment/test-count документацию.
15. **[P3, легко]** Не показывать resend activation как рабочее действие, пока endpoint отсутствует.
16. **[P3, легко/средне]** Добавить TypeScript-проверку Playwright specs/harnesses.
