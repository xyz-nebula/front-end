# Архитектура frontend

## Слои и composition root

`src/main.tsx` подключает провайдеры приложения. `ServiceAdaptersProvider`
читает build-time конфигурацию и создаёт auth, negotiation и audio adapters.
`DomainServicesProvider` связывает их с auth runtime и предоставляет страницам
доменные сервисы.

Направление зависимостей:

```text
pages/components → feature hooks → service contracts ← mock/real adapters
                                      ↑
                             composition root + config
```

- `src/services/contracts` определяет интерфейсы, которыми пользуется UI.
- `src/services/mock` хранит локальную реализацию демонстрационного сценария.
- `src/services/real` инкапсулирует HTTP, WebSocket и wire DTO.
- `src/auth` владеет жизненным циклом auth-сессии и повтором авторизованных
  операций после refresh.
- `src/features` владеет состояниями пользовательских сценариев; страницы
  собирают экран и навигацию.

Страницы и компоненты не должны зависеть от конкретного adapter или разбирать
wire DTO. Новая интеграция сначала оформляется как contract, затем подключается
в composition root.

## Поддерживаемые профили

| Auth / negotiation / audio | Каталог и сессии | Режимы тренировки | Результат |
| --- | --- | --- | --- |
| `mock/mock/mock` | Локальный mock runtime | Text и voice demo | Локальный mock-анализ |
| `real/mock/mock` | Auth реальный, продуктовые данные локальные | Text и voice demo | Локальный mock-анализ |
| `real/real/real` | Backend HTTP | Только voice | Локальный демонстрационный анализ |

Произвольные гибриды не поддерживаются: текущий UI сводит negotiation/audio к
единому признаку real voice и не выражает независимые capabilities. Например,
real negotiation adapter не реализует текстовый ход, а mock/real сочетание не
является проверенным пользовательским сценарием.

`real/real/real` означает готовность frontend-части: реализованы загрузка кейсов
и истории, создание/активация чата, WebSocket, захват PCM с микрофона и
воспроизведение входящих кадров. Совместимость с живыми сервисами должна
проверяться отдельно; известные расхождения перечислены в
[contracts.md](contracts.md).

## Устойчивые инварианты

- Данные подготовки сохраняются с ключом владельца и session ID, чтобы аккаунты
  и mock-сессии не видели чужое локальное состояние.
- Страницы загружаются через `React.lazy`; добавление маршрута не должно включать
  его тяжёлые assets в landing chunk.
- Диалоги удерживают фокус, делают фон inert, закрываются по Escape и возвращают
  фокус на исходный контрол.
- Источники сервисов выбираются только composition root. UI работает через
  contracts и не переключает реализацию локально.
- Styling foundation и правила изоляции зафиксированы в
  [ADR 0001](decisions/0001-plain-css-foundation.md) и
  [styling.md](styling.md).

## Данные и ответственность

Auth tokens хранятся auth runtime. Mock-кейсы, прогресс, сообщения и результаты
принадлежат mock runtime. Подготовка пользователя хранится локально отдельно от
wire session. В real-профиле backend является источником истории чата, но
результат переговоров пока формируется frontend как демонстрационный.

Фактическая карта экранов находится в [routes.md](routes.md), а внешний wire
контракт — в [contracts.md](contracts.md).
