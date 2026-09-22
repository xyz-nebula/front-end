# Арена переговоров — frontend

Frontend-прототип AI-тренажёра переговоров.

## Стек

React, Vite, TypeScript, Tailwind CSS, MUI и React Router.

## Команды

Рабочая версия — Node **24.14.1** (`.node-version`), допустимый диапазон
`engines.node` — `>=24.14.1 <25`. Это закреплённая версия из поддерживаемой
[ветки Node 24 LTS](https://nodejs.org/en/about/previous-releases), совместимая
с [требованиями Vite 8](https://vite.dev/guide/), а не указание на последний patch.

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run check
npm run visual:smoke
```

Для локального просмотра production-сборки используйте `npm run preview`.

## API

Клиент обращается к backend через относительный префикс `/api`. Во время
локальной разработки Vite проксирует запросы на backend и сохраняет полный путь,
включая `/api`.

Перед запуском dev-сервера скопируйте `.env.example` в `.env` и укажите полный
URL backend. Файл `.env` не отслеживается Git, а переменная без префикса
`VITE_` доступна только конфигурации Vite и не попадает в клиентский bundle:

```bash
API_PROXY_TARGET=https://your-backend.example
```

Без `API_PROXY_TARGET` команда `npm run dev` завершится с подсказкой по настройке.
Production-хостинг также должен проксировать `/api/*` на настроенный backend без
удаления `/api`, поскольку backend не отвечает на браузерные CORS
preflight-запросы.

### Авторизация

Следующие сценарии уже используют реальный backend через `/api`: регистрация,
активация аккаунта, вход с необязательным TOTP-кодом, обновление и выход из
сессии, а также подключение, подтверждение и отключение TOTP. Каталог кейсов,
тренировки и данные прогресса пока отображаются из mock-данных; новые
backend-интеграции требуют отдельной задачи.

## Проверки и скриншоты

`npm test` и совместимый alias `npm run visual:smoke` запускают `test:e2e`.
Runner сам поднимает Vite на свободном порту, запускает Playwright в установленном
Google Chrome и завершает запущенные процессы. Живой backend и предварительный
`npm run dev` не нужны: auth/API перехватываются тестами.

В трёх suites сейчас **44 сценария**: landing (7), auth (16) и auth-resilience
(21). Помимо desktop/mobile скриншотов проверяются API-формы, маршруты, TOTP,
ошибки и гонки сессии, storage и cross-tab поведение.

```bash
npm run test:e2e -- landing.spec.ts
npm run test:e2e -- auth-resilience.spec.ts --grep "between tabs"
npm run visual:smoke -- auth.spec.ts
```

`typecheck` проверяет существующий TypeScript project graph (`tsc -b`), без
добавления тестовых spec/helper-файлов или `tsconfig.test.json`. `check`
последовательно выполняет typecheck, lint, e2e и build.

PNG сохраняются в игнорируемую папку `artifacts/visual-smoke/`, очищаемую перед
прогоном. После UI-изменений их обязательно открыть через `view_image`.
Постоянных pixel-diff baseline в проекте нет; для механического CSS-рефакторинга
before/after временно сравниваются вне репозитория.

Подробности запуска и покрытия: [tests/visual/README.md](tests/visual/README.md).

## Руководства

- [Правила работы](AGENTS.md) и [styling policy](docs/styling.md).
- [Карта маршрутов](docs/routes.md) и [инварианты AuthContext](docs/auth.md).
- [Границы OpenAPI](docs/api.md).
- [Архивные дизайн-референсы](examples/README.md).
