# Границы OpenAPI

[`openapi.json`](../openapi.json) передан backend-разработчиком. Это reference
и контракт для согласования запросов/ответов, а не frontend backlog и не
разрешение реализовать все перечисленные возможности.

Сейчас клиент `src/api/auth.ts` использует только auth/TOTP. При стандартном
префиксе `/api` это:

| Метод | Путь |
| --- | --- |
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/register/activate` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/token/refresh` |
| POST | `/api/v1/auth/logout` |
| POST | `/api/v1/auth/totp/enroll` |
| POST | `/api/v1/auth/totp/confirm` |
| DELETE | `/api/v1/auth/totp` |

Кейсы, прогресс и тренировки остаются mock-функциональностью. Наличие chat
и health в контракте само по себе не разрешает их подключение. Новые endpoint'ы,
LLM, backend, WebSocket и другие интеграции требуют отдельной задачи.

Контракт не редактируется попутно с frontend-задачами. Его обновление выполняется
только отдельной синхронизацией с backend; расхождения нужно описывать и
согласовывать, а не подгонять JSON под UI.

Dev-прокси и настройка backend описаны в [README](../README.md#api), сессионные
правила — в [auth.md](auth.md). Playwright перехватывает auth/API и не требует
живого backend; это тестовые mocks, а не характеристика runtime-интеграции.
