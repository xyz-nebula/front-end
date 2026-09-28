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
| `/home` | ProtectedRoute + ProtectedProductShell | Каталог, история, прогресс, приглашение/старт тура, logout и управление TOTP |
| `/cases/:caseId/preparation` | ProtectedRoute + ProtectedProductShell | Выбор стратегии и подготовка к выбранному кейсу; тур синхронизирует раздел через `section` |
| `/arena/:sessionId` | ProtectedRoute + ProtectedProductShell | Text/voice mock flow либо real voice flow согласно профилю; голосовые шаги тура |
| `/result/:sessionId` | ProtectedRoute + ProtectedProductShell | Загрузка результата, финальный шаг тура, демонстрационный разбор и повтор кейса |
| `*` | Публичный | Страница 404 |

Все страницы подключены через `React.lazy`. Четыре продуктовых маршрута вложены
в lazy-loaded `ProtectedProductShell`: он сохраняет `ProductTourProvider` при
переходах между home, preparation, arena и result. Landing и auth-маршруты не
должны загружать код тура, `react-joyride` и assets закрытых экранов до
навигации в защищённую часть.

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

## Маршруты тура

Тур следует реальному голосовому сценарию и не имеет отдельного demo-route.
Состояние маршрута восстанавливается из owner-scoped контекста:

- шаги кейса и роли возвращаются на `/home` (незавершённое модальное состояние
  безопасно сбрасывается к выбору кейса);
- шаги анализа, стратегии и тактики открывают preparation с `role`,
  `mode=voice` и соответствующим `section`;
- шаги микрофона, диалога и завершения открывают сохранённый
  `/arena/:sessionId` только после проверки доступности сессии владельцу;
- финальный шаг открывает `/result/:sessionId` и завершается только после ready
  result и нажатия `Готово`.

Если сохранённая сессия недоступна, тур предлагает начать заново и не удаляет
историю или подготовку. Обычная ручная навигация не запускает поставленный на
паузу тур автоматически.
