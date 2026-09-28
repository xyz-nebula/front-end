# Тестирование

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run typecheck` | Проверить TypeScript-проекты без сборки приложения |
| `npm run lint` | Проверить исходники и тестовую инфраструктуру ESLint |
| `npm run test:e2e` | Запустить Playwright-группы в изолированных source-профилях |
| `npm run visual:smoke` | Тот же browser suite с диагностическими screenshots |
| `npm run build` | Выполнить TypeScript build и собрать production bundle |
| `npm run bundle:report` | Сверить состав `dist/` с bundle budgets |
| `npm run performance:smoke` | Проверить landing в заданном browser/network profile |
| `npm run check` | Последовательно выполнить все обязательные проверки |

Актуальную последовательность `check`, значения budget и параметры runner не
дублируйте в документации: источники истины — `package.json`, файлы в
`scripts/` и `playwright.config.ts`.

Для просмотра актуального состава Playwright suite используйте:

```shell
npm run test:e2e -- --list
```

Отдельный spec или сценарий можно выбрать стандартными аргументами Playwright:

```shell
npm run test:e2e -- auth.spec.ts
npm run test:e2e -- auth-resilience.spec.ts --grep "between tabs"
```

Runner самостоятельно поднимает Vite на свободном loopback-порту, передаёт
`PW_BASE_URL` и завершает сервер после каждой source-группы. Одновременные
прогоны в одном checkout не поддерживаются, потому что используют общую папку
артефактов. Живой backend для обычного suite не нужен: real auth и service
contracts проверяются сетевыми перехватами, а продуктовые сценарии — mock
adapters.

## Виды проверок

- Auth specs покрывают wire payload, route gates, refresh/retry, TOTP,
  конкуренцию вкладок и восстановление сессии.
- Service contract specs проверяют frontend runtime parsers и DTO fixtures. Они
  не заменяют проверку drift против канонических спецификаций сервисов.
- Domain specs покрывают mock storage/runtime, подготовку, переговоры,
  устойчивость аудио и повтор кейса.
- Product tour specs покрывают machine/storage, owner isolation, приглашение
  (`Позже`/`Никогда`), ручной старт, полный голосовой путь, паузу и
  восстановление маршрутов, потерянную сессию и timeout отсутствующего target.
- Visual scenarios проверяют desktop/mobile состояния и horizontal overflow.
- Bundle и performance scripts используют budgets из `scripts/`, а не значения
  из Markdown.

Playwright specs и harnesses сейчас исполняются Playwright и проверяются ESLint,
но не включены в отдельный TypeScript project. Это известное ограничение
тестовой инфраструктуры.

## Артефакты и визуальная проверка

`artifacts/visual-smoke/` содержит временные PNG, а `test-results/` — traces
ошибочных прогонов. Эти каталоги не коммитятся.

После изменения UI, CSS или адаптивности:

1. запустите `npm run visual:smoke`;
2. откройте относящиеся к изменению desktop/mobile PNG;
3. проверьте композицию, overflow, состояния и читаемость вручную.

Успешный Playwright-прогон не заменяет визуальный просмотр и не подтверждает
совместимость с живыми backend/audio-engine.

Для тура основной browser-сценарий находится в
`tests/visual/product-tour-events.spec.ts`. Он сохраняет desktop/mobile кадры
приглашения, выбора кейса и роли, голосового формата, трёх разделов подготовки,
старта поединка, микрофона, диалога, завершения, подтверждения и
pending/ready-разбора. Дополнительно создаются narrow landscape, collapsed,
session recovery и target-timeout кадры. После прогона нужно открыть все PNG с
префиксом `product-tour-` и проверить, что target не перекрыт, карточка не
обрезана, доступные действия видимы, а horizontal overflow отсутствует.
