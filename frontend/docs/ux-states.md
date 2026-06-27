# UI/UX: состояния экранов

Справочник для рефакторинга. Цель — предсказуемое поведение на каждом экране.

## Принципы

| Принцип | Реализация |
|---------|------------|
| Нативный Telegram | `showTelegramConfirm`, `MainButton`, `Snackbar`, closing confirmation |
| Компоненты | `@telegram-apps/telegram-ui` (Section, Cell, Button) + кастом только где нет аналога |
| Ошибки мутаций | `AppErrorBanner` в shell (`App.tsx`) |
| Ошибки загрузки экрана/панели | `ScreenLoadError` / `OwnerPanelError` + retry, не глобальный баннер |
| Loading списков | Skeleton (`FamilyListSkeleton` для карточек, `CellListSkeleton` для Cell-списков) |
| Деструктивные действия | Confirm + undo snackbar 8с (удаление участника) |

## Матрица состояний по экранам

| Экран | Loading | Empty | Error | Примечание |
|-------|---------|-------|-------|------------|
| **Home** | — | quick tiles | `AppErrorBanner` | Дашборд: 2×2 tiles + attention strip |
| **Search** | `FamilyListSkeleton` | «Нет семей» | `ScreenLoadError` | ✅ эталон |
| **MyFamilies** | `CellListSkeleton` | «Нет семей» | `ScreenLoadError` | ✅ |
| **Requests** | `CellListSkeleton` | «Нет заявок» | `ScreenLoadError` | ✅ |
| **CreateFamily** | `MainButton` progress | — | inline `.field-error` | Валидация в реальном времени |
| **FamilyDetails (member)** | `PanelSkeleton` | «Семья не выбрана» | `ScreenLoadError` | Локальный retry |
| **FamilyDetails (owner panel)** | `PanelSkeleton` | кнопка «Заявки и участники» | `OwnerPanelError` + retry | Ленивое открытие, React Query |

## Панель владельца — контракт UX

```
[Заявки и участники]  ← owner-details-button (data-testid)
        ↓ клик
ownerPanelOpen = true
        ↓
isPending → PanelSkeleton
        ↓
details → OwnerDetails (табы: Заявки | Участники | Оплаты)
        ↓ мутация
isFetching → «Обновляем…» (панель остаётся видимой)
        ↓ ошибка
OwnerPanelError + «Повторить»
```

**Не менять:** текст кнопки, ленивое открытие, `data-testid` для E2E.

## Чувствительные данные

- `RequisiteBox` — телефон маскируется до «Показать»
- Реквизиты не в React Query persist

## Компоненты загрузки и ошибок

| Компонент | Где использовать |
|-----------|------------------|
| `FamilyListSkeleton` | Search (карточки в grid) |
| `CellListSkeleton` | MyFamilies, Requests (Cell-списки) |
| `PanelSkeleton` | FamilyDetails, owner panel |
| `ScreenLoadError` | Ошибка query на экране (Search, MyFamilies, Requests, FamilyDetails) |
| `OwnerPanelError` | Ошибка owner workspace (только панель владельца) |

## Вне scope рефакторинга

- Визуальный редизайн / новая цветовая схема
- Marketplace UI
- Onboarding / туториалы