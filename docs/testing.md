# Тестирование

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run typecheck` | Проверить TypeScript-проекты без сборки приложения |
| `npm run lint` | Проверить исходники и тестовую инфраструктуру ESLint |
| `npm run build` | Выполнить TypeScript build и собрать production bundle |
| `npm test` | Запустить короткий Playwright smoke в mock-профиле |
| `npm run test:e2e` | Та же browser-проверка |
| `npm run visual:smoke` | Та же browser-проверка с диагностическими PNG |
| `npm run check` | Последовательно выполнить lint, build и browser smoke |

`build` уже выполняет TypeScript-проверку, поэтому `check` не запускает
`typecheck` отдельно. Browser smoke всегда идёт последним. Runner один раз
поднимает Vite на свободном loopback-порту, запускает Chrome и завершает оба
процесса после прогона. Общий лимит runner — 110 секунд.

Стандартные аргументы Playwright можно передать после `--`, например:

```shell
npm test -- --grep desktop
```

## Покрытие smoke-набора

В `tests/visual/smoke.spec.ts` находятся ровно два сценария: desktop
`1440×900` и mobile `390×844`. Каждый сценарий открывает landing, login,
register, activation, 404, home, preparation, текстовую arena и готовый result.
Для каждого экрана проверяются основной UI и отсутствие горизонтального
overflow, затем сохраняется PNG.

Защищённые экраны получают валидные owner-scoped данные через существующие
`MockAuthClient`, `MockStorage` и `MockRuntime`. Это позволяет проверять маршруты
без прохождения полного цикла регистрации и переговоров через UI. Живые backend
и audio-engine для smoke-набора не нужны.

Набор намеренно не проверяет real adapters, DTO-контракты, auth races,
конкурентные вкладки, повреждение storage, product tour state machine,
audio-engine, polling и performance budgets. При изменении этих механизмов
нужна отдельная целевая проверка в рамках соответствующей задачи.

## Артефакты

`artifacts/visual-smoke/` содержит 18 временных PNG: по одному desktop и mobile
кадру для каждого из девяти экранов. `test-results/` содержит диагностические
артефакты неудачных прогонов. Эти каталоги не коммитятся.

После UI, CSS или адаптивных изменений запустите `npm run visual:smoke` и
вручную откройте относящиеся к изменению PNG. Успешный Playwright-прогон не
заменяет визуальный просмотр и не подтверждает совместимость с живыми сервисами.
