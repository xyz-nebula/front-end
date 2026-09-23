# Playwright: поведение и визуальная диагностика

Текущие 82 сценария запускаются двумя изолированными группами source modes:

| Группа | Сценариев | Spec-файлы и покрытие |
| --- | ---: | --- |
| `real/mock/mock` | 51 | `auth`, `auth-resilience`, `authorized-operation`, `service-contracts`: auth/TOTP, recovery, cross-tab refresh, target DTO и отсутствие сети у real domain stubs. |
| `mock/mock/mock` | 31 | Landing, mock domain/storage, arena session/audio resilience, text/voice flow, result и idempotent repeat. |

Числа включают параметризованные случаи. Список можно проверить
через `npm run test:e2e -- --list`. Инварианты и их привязка к сценариям описаны
в [docs/auth.md](../../docs/auth.md).

## Запуск

Нужны зависимости (`npm install`), закреплённый Node 24.14.1 и установленный
Google Chrome (`channel: 'chrome'` в `playwright.config.ts`).

```bash
npm run test:e2e
npm test
npm run visual:smoke
npm run test:e2e -- auth.spec.ts
npm run test:e2e -- auth-resilience.spec.ts --grep "between tabs"
npm run visual:smoke -- landing.spec.ts
npm run test:e2e -- --list
```

Все три полных команды используют `scripts/run-visual-smoke.mjs`. Аргументы
после `--` передаются Playwright. Runner запускает Vite на свободном loopback
порту, передаёт `PW_BASE_URL`, затем закрывает сервер и процессы тестов, включая
аварийное завершение по лимиту. Одновременно запускать несколько прогонов в одном
checkout нельзя: они используют одну папку artifacts.

Конфигурация использует одного worker, общий лимит 300 секунд, обычный test budget
15 секунд и assertion timeout 5 секунд. Screenshot-heavy activation имеет
локальный test budget 30 секунд; столько же имеют три cross-tab сценария,
которые управляют двумя страницами. Тестовые часы удерживают pending request во
время loading-кадров, чтобы короткий API-timeout не прерывал фотосъёмку.

Runner задаёт `API_PROXY_TARGET=http://127.0.0.1:9` и
`VITE_API_TIMEOUT_MS=600` для auth-группы. Это настройки
тестового процесса, не изменение production defaults. Auth/API-моки задаются
через `page.route`/`context.route`, включая отказы, задержки, rotation и malformed
ответы. Для reproducible запуска используйте те же env и браузер; живой backend
не нужен. Cross-tab сценарии используют страницы одного BrowserContext.

Logout очищает UI до ответа backend, поэтому соответствующий тест отдельно
ждёт завершения intercepted route перед проверкой payload и Authorization.

## Артефакты

`artifacts/visual-smoke/` очищается перед каждым прогоном и содержит временные PNG:

- Landing desktop/mobile, scrolled header, menu, секции problem/how-it-works/
  AI-opponent/teams, включая tablet и узкие mobile viewport.
- Auth choice и login, состояния activation на desktop/mobile.
- Home mobile, session recovery и memory fallback, TOTP/security modal.

Точные имена и viewport заданы в specs. `helpers.ts` объединяет screenshot helper
(animations disabled), проверку горизонтального overflow и подготовку папки.
После успешного UI-прогона релевантные PNG обязательно открыть через `view_image`.
При ошибке Playwright сохраняет trace в `test-results/`; его можно открыть
`npx playwright show-trace <путь-к-trace.zip>`.

Это диагностические кадры, не постоянные pixel-diff эталоны. Для механического
CSS-разделения сохраните зелёный before-прогон и SHA-256 manifest во временную
папку вне checkout, затем сравните PNG одинаковых имён после того же прогона.
`examples/` — отдельный архив дизайн-референсов, его нельзя обновлять для
маскировки отличий. Artifacts, traces, baseline и `dist/` не коммитятся.

## Остальные проверки

`npm run typecheck`, `npm run lint`, `npm run build` доступны отдельно.
`npm run check` последовательно запускает typecheck, lint, e2e и build.
Typecheck сохраняет существующие app/node проекты; Playwright specs/helpers
не включаются в них, отдельного `tsconfig.test.json` нет. Выполнение Playwright
не является отдельной TypeScript-проверкой тестов.
