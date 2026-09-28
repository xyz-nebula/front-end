# План интеграции серверных результатов переговоров

Дата: 28 сентября 2026 года.

## Зафиксированное решение по контракту

Backend-команда подтвердила, что payload результата не будет преобразовываться в отдельную backend DTO. Frontend принимает публичным контрактом результат AI-сервиса `EvaluationResponse` версии `2.0.0-rc.1`, обёрнутый в backend `EvaluationResultResponse`.

Источники контракта:

- backend API: <https://nebula.tx0.su/api/openapi.json>;
- AI wire-модели: <https://github.com/xyz-nebula/ai-system/blob/dev/src/arena_ai/v2/evaluation_response.py>;
- AI contract version: `2.0.0-rc.1`.

Ожидаемая backend-обёртка:

```json
{
  "status": "pending | processing | done | failed",
  "result": "EvaluationResponse | null",
  "error": "string | null"
}
```

Frontend самостоятельно реализует строгий runtime parser для `EvaluationResponse`, поскольку live backend OpenAPI пока описывает `result` как произвольный объект.

## Цель

Заменить локальный демонстрационный результат в профиле `real/real/real` на серверный workflow:

```text
Завершить переговоры
  → POST /v1/chats/{chat_uuid}/evaluate
  → pending / processing
  → GET /v1/chats/{chat_uuid}/result
  → done + EvaluationResponse
  → экран результата
```

Mock-профили должны сохранить автономную работу и не обращаться к backend или AI.

## Не входит в эту интеграцию

- новый backend API;
- прямые запросы browser → AI service;
- real text-mode переговоров;
- генерация числового score, которого нет в AI-контракте;
- искусственное сведение всех исходов к `victory/defeat`;
- показ скрытых материалов кейса или внутренних retrieval-данных;
- редизайн экранов вне результата и связанных статусов истории.

## Этап 1. Зафиксировать wire-типы и runtime parser

### 1.1. Добавить wire DTO

В `src/services/real/targetContract.ts` описать без `any`:

- `EvaluationJobStatusDto`:
  - `pending`;
  - `processing`;
  - `done`;
  - `failed`;
- `EvaluateTriggerResponseDto`;
- `EvaluationResultResponseDto`;
- `EvaluationResponseDto` версии `2.0.0-rc.1`;
- outcome slot и assessment;
- три judge slots;
- trainer slot и feedback;
- evidence;
- plan comparison;
- goal assessment;
- все публичные enum и error codes.

Wire-типы должны повторять AI-контракт, но не экспортироваться в страницы и компоненты.

### 1.2. Реализовать строгий parser

Добавить функции:

```ts
parseEvaluateTrigger(value: unknown): ParsedEvaluateTrigger
parseEvaluationResult(value: unknown, session: NegotiationSession): NegotiationResultState
```

Parser обязан проверить:

- `contract_version === '2.0.0-rc.1'`;
- согласованность `status`, `result` и `error`;
- наличие `result` только для `done`;
- обязательные поля каждого slot;
- соответствие `ready` наличию payload;
- соответствие `failed` наличию допустимого `error_code`;
- допустимые outcome kinds;
- допустимые judge colleges и отсутствие дубликатов;
- наличие ровно трёх judge slots;
- допустимые judge criteria и choices;
- границы `message_index`;
- совпадение `evidence.is_ai` с автором сообщения по указанному индексу;
- непустую evidence quote;
- при возможности — вхождение quote в исходное сообщение;
- ограничения `next_try` на 2–3 элемента;
- nullable-семантику `plan_vs_reality` и `goal_text`.

Некорректный payload должен превращаться в `ServiceError` с причиной `invalid-response`, а не частично попадать в UI.

### 1.3. Обновить parser чата

Добавить backend statuses:

```text
ongoing | evaluating | evaluated | victory | defeat
```

Маппинг в frontend:

| Backend status | Frontend status |
| --- | --- |
| `ongoing` | `active` |
| `evaluating` | `finishing` |
| `evaluated` | `finished` |
| `victory` | `finished` — legacy |
| `defeat` | `finished` — legacy |

Также разобрать и сохранить `selected_role` и `preparations`, не раскрывая скрытые role preparations из кейса.

## Этап 2. Обновить доменную модель frontend

Текущий `NegotiationResult` основан на mock-предположениях `victory/defeat + score`. Его нужно заменить моделью, способной без потерь выразить AI-контракт.

### 2.1. Исход переговоров

Добавить:

```ts
type NegotiationOutcomeKind =
  | 'agreement'
  | 'partial-agreement'
  | 'deferred'
  | 'no-agreement'
  | 'not-assessable'
```

Доменный outcome должен содержать:

- `kind`;
- `summary`;
- `agreedTerms`;
- `openPoints`;
- `nextStep`;
- `evidence`;
- либо локализуемое failed-состояние секции.

Не добавлять `score`: AI его не возвращает.

### 2.2. Судьи

Каждый judge slot хранить отдельно:

- `college`;
- `status: ready | failed`;
- готовый verdict либо error reason;
- `choice: user | opponent` после преобразования AI `player | opponent`;
- criterion, evidence, observation, effect и comparison.

Ошибка одного судьи не должна скрывать двух готовых судей.

### 2.3. Trainer

Trainer должен поддерживать:

- `ready` с полным feedback;
- `failed` с локализуемой причиной;
- strengths;
- mistakes;
- missed opportunities;
- next try;
- nullable plan vs reality;
- goal assessment.

### 2.4. Источник результата

Добавить к доменному результату метаданные:

```ts
source: 'mock' | 'server'
contractVersion?: '2.0.0-rc.1'
```

Это позволит:

- показывать demo-note только для mock;
- не определять источник по `isRealVoice`;
- не смешивать server result с mock fallback.

`NegotiationResultState` можно сохранить:

```ts
type NegotiationResultState =
  | { status: 'processing' }
  | { status: 'ready'; result: NegotiationResult }
  | { status: 'failed'; message: string }
```

Здесь `ready` означает, что evaluation job завершён. Внутри результата отдельные judge/trainer/outcome slots всё ещё могут быть failed.

## Этап 3. Подключить backend workflow

### 3.1. Запуск анализа

В `BackendNegotiationClient.finishSession`:

1. Выполнить `POST /v1/chats/{sessionId}/evaluate` без body.
2. Проверить `job_uuid` и status.
3. Для `pending` или `processing` вернуть `{ status: 'processing' }`.
4. На `409 already_evaluating` не показывать ошибку, а вернуть processing и продолжить через `GET /result`.
5. Остальные `404/409/422` преобразовать в понятный `ServiceError`.

`clientCommandId` пока остаётся частью frontend contract для mock и защиты UI от двойного submit, но не отправляется backend, пока сервер не поддерживает idempotency key.

### 3.2. Получение результата

В `BackendNegotiationClient.getResult`:

1. Выполнить `GET /v1/chats/{sessionId}/result`.
2. Преобразовать:

| Backend job | Frontend state |
| --- | --- |
| `pending` | `processing` |
| `processing` | `processing` |
| `done` | `ready` после строгого parsing |
| `failed` | `failed` |

3. Не показывать пользователю сырой текст `error`, пока backend не гарантирует, что он безопасен. Логировать техническую причину только разрешённым способом, а в UI использовать стабильное сообщение.
4. `404 evaluation_not_found` на странице результата показывать как отсутствие результата, не как бесконечный processing.

### 3.3. HTTP method support

Расширить внутренний `RequestOptions.method` только необходимыми методами. Для этой интеграции достаточно существующего `POST` и `GET`.

### 3.4. Не обращаться напрямую к AI

Frontend использует только same-origin backend `/api/v1/...`. AI service token и `X-Arena-Contract-Version` остаются ответственностью backend.

## Этап 4. Переделать polling

Текущий polling заканчивается примерно за несколько секунд, но backend AI timeout составляет минуты. Нужен deadline-based polling.

Предлагаемое поведение:

- первые проверки через `500 ms`, `1 s`, `2 s`;
- затем polling раз в `3–5 s`;
- общий deadline не меньше `6 min`, чтобы покрыть backend AI timeout около `330 s`;
- прекращение polling при unmount, смене session ID или ручном retry;
- только один активный polling loop на session;
- отсутствие параллельных `GET /result`;
- пауза или снижение частоты в скрытой вкладке — опциональная оптимизация;
- после deadline показать «Разбор готовится дольше обычного» и кнопку проверки, не объявлять job failed.

Retry должен продолжать чтение существующего job, а не повторно запускать `/evaluate`.

## Этап 5. Адаптировать экран результата

### 5.1. Итог переговоров

Отображать пять состояний отдельно:

| Outcome | Смысл UI |
| --- | --- |
| `agreement` | Договорённость достигнута |
| `partial_agreement` | Частичная договорённость |
| `deferred` | Решение отложено |
| `no_agreement` | Договорённость не достигнута |
| `not_assessable` | Недостаточно данных для оценки |

Не использовать бинарную зелёную/красную трактовку для всех случаев. Точные тексты и цвета считаются небольшим UI-решением, но смысл статуса должен соответствовать backend.

Если outcome slot failed, остальные готовые секции всё равно показываются.

### 5.2. Судьи

- Готовый slot показывает verdict как сейчас, но использует server evidence.
- Failed slot остаётся на своём месте и показывает нейтральное сообщение «Вердикт недоступен».
- Не показывать технические retrieval error codes пользователю.
- Не скрывать всю сетку из-за одного failed slot.

### 5.3. Trainer

- `strengths` → «Что сработало»;
- `mistakes` → «Что помешало»;
- `missed_opportunities` → отдельная секция или блок внутри разбора тренера;
- `next_try` → рекомендации следующей попытки;
- `goal_assessment` → отдельный блок достижения цели;
- failed Trainer → локальное unavailable-состояние без mock-подстановки.

### 5.4. План vs реальность

- Показывать только при непустом `plan_vs_reality`.
- AI `not_observed` преобразовать во frontend `unused` либо переименовать доменный статус в `not-observed` и обновить CSS.
- Evidence для плана должно ссылаться только на пользовательскую реплику; parser проверяет `is_ai === false`.
- Если backend не сохранил preparations и AI вернул `null`, секцию скрыть с коротким объяснением, не генерировать mock-анализ.

### 5.5. Удалить server/mock смешивание

Для server result запрещён fallback:

```ts
result.analysis ?? createMockResultAnalysis(...)
```

`createMockResultAnalysis` остаётся только в mock runtime. Server result либо отображается по реальным данным, либо показывает локальное unavailable-состояние соответствующей секции.

Demo-note показывается только при `result.source === 'mock'`.

### 5.6. Транскрипт и evidence

Транскрипт продолжает загружаться через `GET /v1/chats/{uuid}`. Evidence связывается с сообщением по `message_index` только внутри parser/mapping; UI может показывать цитату из результата.

Если backend изменил порядок сообщений или evidence не совпадает, весь результат считается несовместимым ответом, а не молча привязывается к другой реплике.

## Этап 6. Сохранить mock-профили

Mock adapter и mock runtime нужно перевести на новую доменную модель результата:

- сохранить состояния processing/ready/failed;
- формировать все пять типов outcome минимум в fixtures, даже если основной demo использует два;
- формировать три judge slots;
- формировать trainer slot;
- устанавливать `source: 'mock'`;
- не копировать wire DTO AI в mock storage.

Миграция локально сохранённых старых mock results:

- либо повысить версию ключа mock storage;
- либо добавить безопасный migration parser;
- не читать старый payload как новую модель без проверки.

Owner-scoped storage остаётся обязательным.

## Этап 7. Тестирование

### 7.1. Contract tests real adapter

Добавить fixtures и проверки для:

1. `POST /evaluate → 202 pending`.
2. `409 already_evaluating → processing`.
3. `GET /result → pending`.
4. `GET /result → processing`.
5. Полного `done` результата.
6. `done` с одним failed judge.
7. `done` с failed trainer.
8. `done` с failed outcome, но готовыми другими секциями.
9. `failed` evaluation job.
10. `404 evaluation_not_found`.
11. Неизвестной `contract_version`.
12. Неизвестного enum/error code.
13. Неверного `message_index`.
14. Несовпадения `is_ai` с сообщением.
15. Неверной или отсутствующей evidence quote.
16. Дубликата judge college или неполного набора судей.
17. `plan_vs_reality: null`.

### 7.2. Hook resilience tests

Проверить:

- polling до `done`;
- отмену при смене session;
- отсутствие stale updates;
- отсутствие параллельных запросов;
- ручной retry после network error;
- продолжение после deadline;
- failed job;
- unmount во время ожидания.

### 7.3. Visual tests

Расширить `tests/visual/result.spec.ts` состояниями:

- processing desktop;
- processing mobile;
- agreement;
- partial agreement;
- deferred;
- no agreement;
- not assessable;
- failed judge slot;
- failed trainer;
- отсутствующий plan vs reality;
- полностью failed job;
- длинные русские тексты и цитаты.

После UI/CSS изменений выполнить:

```bash
npm run check
npm run visual:smoke
```

Затем вручную проверить относящиеся к результату desktop/mobile PNG в `artifacts/visual-smoke/`.

## Этап 8. Документация

Обновить:

- `docs/contracts.md` — новые endpoints, статусы и AI contract version;
- `docs/architecture.md` — backend становится источником real result;
- `docs/routes.md` — состояния страницы результата;
- `docs/testing.md` — contract и visual scenarios;
- `README.md` — возможности профиля `real/real/real` после успешной проверки.

Убрать утверждение, что real result формируется frontend как демонстрационный.

## Зависимость от backend, которая остаётся

Фиксация AI result contract позволяет начать и закончить большую часть frontend-интеграции. Однако полноценный `plan_vs_reality` зависит от сохранения пользовательской подготовки.

Пока backend не принимает `preparations` в `ChatCreateRequest`:

- frontend продолжает хранить подготовку owner-scoped локально;
- server evaluation получает пустую preparation;
- server `plan_vs_reality` ожидаемо будет `null`;
- frontend не должен подмешивать локально сгенерированное сравнение в server result;
- экран может честно показать, что сравнение плана недоступно.

Также до исправления OpenAPI frontend будет поддерживать собственный parser по AI source contract. Это допустимо при подтверждённой стабильности `2.0.0-rc.1`, но изменение версии должно обрабатываться как несовместимый ответ.

## Рекомендуемый порядок реализации

1. Wire DTO и runtime parser AI `2.0.0-rc.1`.
2. Новые chat statuses и session mapping.
3. Новая доменная модель результата.
4. Миграция mock runtime на новую модель.
5. `POST /evaluate` и `GET /result` в real adapter.
6. Deadline-based polling.
7. Адаптация компонентов результата без mock fallback.
8. Contract и resilience tests.
9. Visual states и CSS.
10. Документация.
11. Проверка с живым backend на тестовом аккаунте.

Такой порядок сначала стабилизирует границы данных и сохраняет mock-профили работоспособными, затем подключает сеть и только после этого меняет UI.

## Критерии готовности frontend

- [ ] Real adapter запускает evaluation и получает результат только через backend.
- [ ] Поддерживаются `pending`, `processing`, `done`, `failed`.
- [ ] Поддерживаются chat statuses `evaluating` и `evaluated`.
- [ ] AI payload `2.0.0-rc.1` строго валидируется до попадания в UI.
- [ ] Неизвестная contract version приводит к понятной ошибке совместимости.
- [ ] Все пять outcome kinds отображаются без сведения к бинарному результату.
- [ ] Частичные ошибки судей/Trainer не скрывают готовые секции.
- [ ] Server result никогда не дополняется mock-анализом.
- [ ] Demo-note показывается только для mock result.
- [ ] Polling выдерживает длительную серверную обработку и корректно отменяется.
- [ ] Двойное нажатие и `already_evaluating` не создают ошибочный UX.
- [ ] Mock-профили продолжают работать автономно.
- [ ] Owner-scoped preparation storage сохранён.
- [ ] `npm run check` проходит.
- [ ] `npm run visual:smoke` проходит, относящиеся PNG проверены вручную.
- [ ] Real smoke подтверждает полный цикл на deployed backend.

## Риски и меры

| Риск | Мера |
| --- | --- |
| Backend OpenAPI оставляет `result` нетипизированным | Собственный строгий parser по AI `2.0.0-rc.1` |
| AI contract version изменится | Проверять `contract_version`, падать с `invalid-response` |
| Анализ длится несколько минут | Deadline-based polling не меньше 6 минут |
| Один AI slot недоступен | Частичное отображение результата |
| Preparation не попадает в backend | Не показывать выдуманный plan comparison |
| Timeout trigger имеет неоднозначный исход | `already_evaluating` трактовать как восстановление и продолжать polling |
| Старые mock results несовместимы | Версия storage или явная миграция |
| Evidence указывает на неверную реплику | Валидация индекса, автора и цитаты |

