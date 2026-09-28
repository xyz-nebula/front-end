# Карта приложения

Источник истины — `src/App.tsx` и `src/components/auth/RouteGate.tsx`.
Навигация клиентская, поэтому production-хостинг должен возвращать `index.html`
для прямого открытия маршрутов приложения.

| Путь | Доступ | Экран и поведение |
| --- | --- | --- |
| `/` | Публичный | Landing, доступный независимо от auth-сессии |
| `/auth` | Публичный redirect | Перенаправление на `/login` |
| `/login` | GuestRoute | Email, пароль и необязательный TOTP |
| `/register` | GuestRoute | Регистрация и переход к подтверждению email |
| `/activate` | ActivationRoute | Ожидание письма, активация по query code, success/error |
| `/home` | ProtectedRoute | Каталог, история, прогресс, logout и управление TOTP |
| `/cases/:caseId/preparation` | ProtectedRoute | Выбор стратегии и подготовка к выбранному кейсу |
| `/arena/:sessionId` | ProtectedRoute | Text/voice mock flow либо real voice flow согласно профилю |
| `/result/:sessionId` | ProtectedRoute | Загрузка результата, демонстрационный разбор и повтор кейса |
| `*` | Публичный | Страница 404 |

Все страницы подключены через `React.lazy`. Landing не должен загружать assets
закрытых маршрутов до навигации.

GuestRoute, ProtectedRoute и ActivationRoute показывают session loading при
bootstrap и sign-out. При временной ошибке восстановления доступен recovery с
повтором и выходом без преждевременного удаления сохранённых tokens.

Авторизованный посетитель guest-only страниц перенаправляется на `/home`.
Гость protected-маршрута попадает на `/login` с безопасным внутренним
`state.from`, после входа исходный маршрут восстанавливается.

Landing CTA ведут на `/home`: гость проходит через login, пользователь с
сессией сразу открывает приложение. ActivationRoute не заменяет уже
подтверждённую сессию кодом из письма и не отправляет невалидный UUID backend.

Источник negotiation/audio выбирается composition root, а не маршрутом. Три
поддерживаемых профиля и ограничения real voice описаны в
[architecture.md](architecture.md). На result route real adapter пока также
возвращает локальный демонстрационный анализ.

Подробности auth state machine находятся в [auth.md](auth.md), а набор проверок
маршрутов — в [testing.md](testing.md).
