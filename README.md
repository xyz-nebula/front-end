# Арена переговоров — frontend

Frontend-прототип AI-тренажёра переговоров.

## Стек

React, Vite, TypeScript, Tailwind CSS, MUI и React Router.

## Команды

```bash
npm install
npm run dev
npm run build
npm run lint
npm run visual:smoke
```

Для локального просмотра production-сборки используйте `npm run preview`.

## API

Клиент обращается к backend через относительный префикс `/api`. Во время
локальной разработки Vite проксирует его на `https://api.nebula.tx0.su` и
удаляет префикс перед отправкой запроса.

Переменную окружения можно переопределить по образцу `.env.example`:

```bash
VITE_API_BASE_URL=/api
```

Production-хостинг также должен проксировать `/api/*` на
`https://api.nebula.tx0.su/*`, поскольку backend не отвечает на браузерные
CORS preflight-запросы.

## Визуальная проверка

`npm run visual:smoke` самостоятельно запускает Vite на свободном локальном
порту, выполняет Playwright-сценарии в установленном Google Chrome и затем
останавливает все запущенные процессы. Предварительно запускать `npm run dev`
не нужно.

Скриншоты сохраняются в `artifacts/visual-smoke/`. Папка очищается перед каждым
прогоном и не отслеживается Git. Эти файлы предназначены для локальной
диагностики: Codex открывает их через `view_image`; pixel-diff и эталонные
снимки в проекте не используются.

Текущий базовый сценарий создаёт:

- `landing-desktop.png` для viewport `1440×900`;
- `landing-mobile.png` для viewport `390×844`.

Playwright-аргументы можно передать после `--`, например:

```bash
npm run visual:smoke -- landing.spec.ts
```
