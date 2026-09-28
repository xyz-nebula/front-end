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
- Visual scenarios проверяют desktop/mobile состояния и horizontal overflow.
- Bundle и performance scripts используют budgets из `scripts/`, а не значения
  из Markdown.

Playwright specs и harnesses сейчас исполняются Playwright и проверяются ESLint,
но не включены в отдельный TypeScript project. Это известное ограничение
тестовой инфраструктуры.

## Проверки серверного результата

`tests/visual/service-contracts.spec.ts` фиксирует границу real adapter без
живого backend: запуск `/evaluate` без body, состояния `pending`/`processing`,
восстановление после `already_evaluating`, безопасные сообщения для failed job и
`evaluation_not_found`, а также полный `done` с дополнительной загрузкой
транскрипта. Fixtures контракта `2.0.0-rc.1` проверяют готовые и failed slots,
nullable `plan_vs_reality`/`goal_text` и отклонение несовместимой версии,
неверного evidence, дубликатов судей и несогласованных job states.

`tests/visual/result-polling-resilience.spec.ts` проверяет интервалы и
шестиминутный deadline, последовательные запросы без параллельных `GET`, отмену
устаревшего цикла при смене session или unmount и продолжение чтения после
ручной проверки. `tests/visual/result.spec.ts` покрывает processing, готовый
разбор, ошибку с recovery actions, повтор кейса и отсутствие горизонтального
overflow на desktop/mobile. Все пять outcome kinds дополнительно фиксируются
fixtures mock runtime в `tests/visual/mock-domain.spec.ts`.

Эти проверки подтверждают frontend-контракт и поведение интерфейса, но не
заменяют smoke на стенде. Для `real/real/real` вручную пройдите полный цикл от
завершения voice-сессии до `done`, проверьте транскрипт/evidence, частично
недоступные секции и отсутствие mock-пометки у server result.

## Артефакты и визуальная проверка

`artifacts/visual-smoke/` содержит временные PNG, а `test-results/` — traces
ошибочных прогонов. Эти каталоги не коммитятся.

После изменения UI, CSS или адаптивности:

1. запустите `npm run visual:smoke`;
2. откройте относящиеся к изменению desktop/mobile PNG;
3. проверьте композицию, overflow, состояния и читаемость вручную.

Успешный Playwright-прогон не заменяет визуальный просмотр и не подтверждает
совместимость с живыми backend/audio-engine.
