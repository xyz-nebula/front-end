# Сессия и защищённые инварианты

Auth доступен как в реальном, так и в mock-режиме. Основные владельцы:
`src/auth/AuthContext.tsx`, `src/auth/storage.ts`, `src/auth/useAuth.ts`,
`src/services/contracts/authClient.ts`,
`src/services/real/backendAuthClient.ts`, `src/services/mock/mockAuthClient.ts`
и `src/components/auth/RouteGate.tsx`.
Документ фиксирует поведение; он не разрешает новые API-интеграции.

`VITE_AUTH_SOURCE=real` использует backend через `/api` для регистрации,
активации, login/refresh/logout и TOTP. `VITE_AUTH_SOURCE=mock` выполняет те же
frontend-сценарии локально. Auth storage содержит `source`, поэтому credentials
одного режима не восстанавливаются в другом.

## Состояния

| Статус | Смысл |
| --- | --- |
| `unauthenticated` | Активной локальной сессии нет. |
| `booting` | Проверка сохранённых токенов через refresh, в том числе повтор восстановления. |
| `authenticated` | Сессия доступна; хранение persistent либо memory. |
| `restore-error` | Восстановление временно не удалось; токены сохранены, доступны повтор и выход. |
| `signing-out` | Переходное состояние logout; локальная очистка синхронная, UI не ждёт сеть. |

Без сохранённых токенов стартуем гостем. Наличие токенов запускает bootstrap
refresh один раз, в том числе под React StrictMode. Пара access/refresh,
`source` и стабильный `mockOwnerKey` хранятся под `arena.auth.tokens.v1`; wire
API использует snake_case, клиент — camelCase.
Успешный HTTP-ответ сам по себе недостаточен: клиент проверяет структуру токенов,
регистрации и TOTP enrollment, несовместимый ответ становится `invalid-response`.

## Инварианты AuthContext

1. **Late-response fencing.** `sessionVersionRef` отслеживает изменения токенов,
   `sessionGenerationRef` — замену/завершение сессии,
   `sessionCreationGenerationRef` — актуальность login/activation.
   Старый success или error не вправе восстановить вышедшего пользователя,
   перезаписать или очистить новую сессию. Это разные счётчики с разными задачами.
2. **Last-started login.** Только последняя начатая операция создания сессии
   может сохранить результат. Более ранняя activation/login отбрасывается,
   даже если завершилась позже. Logout и внешняя замена сессии также инвалидируют
   незавершённое создание сессии.
3. **Optimistic logout.** Токены и локальный UI очищаются сразу, выставляется
   `logoutRequested`; возвращаемый promise не ждёт remote revoke.
   Зависший/неуспешный запрос не возвращает пользователя в authenticated.
4. **Best-effort revoke.** Logout отправляет снимок access/refresh завершённой
   сессии. При 401 он отдельно refresh-ит этот снимок и повторяет logout.
   Эти токены не сохраняются через `saveSession`; ошибки подавляются и не могут
   затронуть новый вход. Logout и его вспомогательный refresh имеют лимит 3 с.
5. **Retry после 401.** `runAuthorized` делает одну попытку, после 401 — refresh
   и один повтор с новым access token. Проверки generation стоят до и после
   асинхронных шагов: нельзя повторить старое действие от лица новой сессии или
   принять его запоздавший success. Ротация refresh в той же сессии допустима.
6. **Окончательные отказы.** HTTP 401/403 от refresh завершают соответствующую
   сессию. Удаление storage условное: только если refresh token всё ещё тот же;
   обнаруженная новая пара из другой вкладки принимается вместо удаления.
   Повторный 401 защищённой операции очищает сессию только при неизменной
   версии. Обычный 403 самой защищённой операции пробрасывается вызывающему коду,
   а не автоматически разлогинивает пользователя.
7. **Transient restore error.** Network, timeout, 5xx и invalid-response при
   bootstrap не удаляют валидные сохранённые токены: показывается recovery.
   Повтор восстанавливает сессию. Временный refresh-сбой внутри защищённой
   операции также сохраняет authenticated-сессию и возвращает ошибку операции.
8. **Memory fallback.** Исключения localStorage не ломают вход. После ошибки
   записи клиент пытается убрать старые токены и хранит новую пару в памяти;
   уведомление объясняет ограничение одной вкладкой и исчезновение сессии после
   перезагрузки. Это best-effort очистка: недоступное хранилище не гарантирует
   удаление. Повреждённое значение не превращается в сессию.
9. **Storage events.** Новая корректная пара из другой вкладки принимается,
   инвалидирует старые операции и увеличивает `externalSessionVersion`.
   HomePage закрывает прежнее security-окно при такой замене. Удаление ключа
   или очистка storage завершает локальную сессию без повторной записи;
   посторонние ключи и некорректные новые значения не принимаются.
10. **Refresh deduplication.** В одной вкладке повторные refresh-запросы для одной
    версии используют общий promise. Завершение старого promise не может сбросить
    указатель на новую refresh-операцию.
11. **Межвкладочная ротация.** При persistent-хранении и наличии `navigator.locks`
    refresh сериализуется под `arena.auth.tokens.v1.refresh`. После получения
    lock повторно проверяются версия и storage: уже обновлённая пара принимается
    без повторного использования старого refresh token. В memory-режиме или без
    Locks API остаются локальная дедупликация и fencing; межвкладочная
    сериализация в этих условиях не гарантируется.

## Regression-защита

Не упрощать эти механизмы без эквивалентных regression-тестов, сохраняющих
проверку гонок, ошибок и защиты новой сессии. Проходящий happy path не заменяет
проверки late responses. Runtime-код не требуется менять для актуализации docs.

| Область | Существующие сценарии |
| --- | --- |
| Реальные API-формы, payload, StrictMode, gates, refresh/retry, TOTP | [auth.spec.ts](../tests/visual/auth.spec.ts): `activates from a link only once…`, `does not replace an existing session…`, `returns to a protected route…`, `refreshes once after a protected 401…`. |
| Валидация API-ответов | `auth.spec.ts`: сценарии `rejects malformed…` для login, activation, refresh, registration и enrollment. |
| Поздние ответы и last-started login | [auth-resilience.spec.ts](../tests/visual/auth-resilience.spec.ts): `does not let a delayed activation…`, `keeps the result of the last-started concurrent login`, `does not restore a pending login after logout`. |
| Optimistic logout и revoke | `auth-resilience.spec.ts`: `optimistic logout clears the UI…`, `retries remote logout after refreshing a rejected snapshot`. |
| Временные ошибки и окончательный отказ | `auth-resilience.spec.ts`: `keeps tokens after a transient bootstrap failure…`, network/timeout варианты, `clears a session when refresh is rejected with 403`, `keeps an authenticated session when refresh fails…`; invalid refresh также проверяется в `auth.spec.ts`. |
| Защита новой сессии от операций старой | `auth-resilience.spec.ts`: `does not retry a protected request with a replacement session`, `discards a late protected success…`, `closes an open security modal…`. |
| Storage, memory и межвкладочная ротация | `auth-resilience.spec.ts`: `survives corrupted storage…`, `uses a one-tab memory session…`, `synchronizes login, token rotation, and logout between tabs`, `serializes simultaneous bootstrap refreshes between tabs`, `does not let a stale refresh overwrite…`. |

Эта карта связывает инварианты с имеющимися проверками, но не утверждает, что
каждая внутренняя ветвь отдельно покрыта: при изменении конкретного механизма
добавляйте regression для его ветви и конкурентного сценария.
