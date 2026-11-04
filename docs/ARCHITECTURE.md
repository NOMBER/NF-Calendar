# Архитектура Calendar (Weekday Templates)

Плагин разделён на три слоя. Зависимости направлены только вниз: `ui` → `io` → `core`.

```
src/
├── main.ts            Точка входа: жизненный цикл плагина, команды, действия (открыть / создать / применить шаблон)
├── constants.ts       Общие константы (id панели, события)
├── core/              Чистая логика БЕЗ Obsidian API, полностью покрыта тестами
│   ├── dates.ts         Даты: UID, разбор имени заметки, диапазоны, недостающие и соседние даты
│   ├── paths.ts         Пути хранилища: sanitizeVaultPath / buildNotePath (защита от выхода за пределы)
│   ├── rules.ts         Правила шаблонов и выбор шаблона (правило → день недели → по умолчанию)
│   ├── placeholders.ts  Подстановки {{date}}, {{date+1d:FMT}}, {{monday:FMT}}, {{carryover}} …
│   ├── merge.ts         Слияние шаблона с существующей заметкой (в конец / в начало / замена)
│   ├── stats.ts         Подсчёт слов и задач, итоги месяца, ✓-дни, серия, открытые задачи для переноса
│   ├── important.ts     Важные дни: метки, дни подготовки, ближайшие события, свои цвета #rrggbb → CSS
│   ├── dots.ts          Что означают точки под днями (задачи / слова / есть заметка / нет)
│   ├── holidays.ts      Праздники из папки: разбор даты в имени (DD.MM, MM-DD, YYYY-MM-DD, свой шаблон), индекс, возраст
│   ├── charts.ts        Подготовка данных для графиков: ряды, шкала, нарастающий итог, доли ✓, дуги кольца
│   ├── settings.ts      Формат data.json, миграция 1.x → 2 → 3, валидация и лимиты
│   ├── i18n.ts          Строки интерфейса en / ru
│   └── __tests__/       Jest-тесты (включая security.test.ts: пути, data.json, ReDoS)
├── io/                Доступ к хранилищу через Obsidian API
│   ├── notes.ts         Поиск, создание (без перезаписи), рендер шаблона, перенос задач
│   ├── noteStats.ts     Слова и задачи заметки для окна статистики
│   ├── holidays.ts      Кэш-индекс папки праздников (svelte store), пересборка только по событиям папки
│   └── external.ts      Единственное место, где читаются настройки Daily Notes / Periodic Notes (импорт, миграция)
└── ui/                Интерфейс
    ├── view.ts          Панель календаря (ItemView) + Svelte-компонент Calendar.svelte
    ├── menus.ts         Меню ⋯, контекстные меню дня, недели и заголовка месяца
    ├── settingsTab.ts   Вкладка настроек
    ├── templatePreview.ts  Подсказка с шаблоном при наведении на пустой день
    ├── upcoming.ts      Блок «Ближайшие важные дни» (важные дни + праздники)
    ├── charts.ts        SVG-графики (createElementNS, CSS-переменные темы, подсказки)
    ├── labels.ts        Общие подписи (тип заметки, причина выбора шаблона)
    ├── stores.ts        Svelte-хранилища: индексы заметок, активный файл, настройки
    ├── sources/         Индикаторы календаря (точки по режиму `dots`, теги, важные дни, праздники, серия)
    └── modals/          Модальные окна: confirm, applyTemplate, batchCreate, importantDay, importantList, stats, dateNavigator
```

## Поток данных

1. **Загрузка.** `main.onload` читает `data.json` → `core/settings.migrateSettings` (валидация, лимиты, миграция) →
   `settings` store → регистрируются панель, команды и вкладка настроек.
2. **Индекс.** `ui/stores` строит индексы заметок через `io/notes.getAllNotes` (только по папке и формату из настроек
   плагина). События хранилища (`create/delete/modify/rename`) в `ui/view` вызывают `reindex`.
3. **Клик по дню.** `view` → `main.openPeriodic` → `io/notes.findNote`. Если заметки нет:
   `getNotePath` (→ `core/paths.buildNotePath`, при небезопасном пути — `null` и уведомление) →
   при необходимости `ConfirmationModal` → `io/notes.createNote`.
4. **Создание заметки.** `createNote` → `renderTemplateFor`: `core/rules.chooseTemplate` выбирает шаблон,
   `resolveTemplateFile` проверяет путь шаблона, `core/placeholders.applyTemplate` делает подстановки
   (`{{carryover}}` — открытые задачи предыдущей ежедневной заметки, `core/stats.extractOpenTasks`) →
   `vault.create`. Существующий файл никогда не перезаписывается: проверка до и после чтения шаблона,
   параллельные вызовы на один путь объединяются.
5. **Применить шаблон.** `main.applyTemplateToNote` → `ApplyTemplateModal` (дописать / в начало / заменить с
   подтверждением / **пропустить**) → `core/merge.mergeTemplate` → `vault.process`.
6. **Массовое создание.** `main.createMissingDailyNotes` → `core/dates.missingDates` → `BatchCreateModal` →
   `runBatch`: последовательно, по одному файлу, существующие заметки пропускаются, повторный запуск во время
   работы игнорируется.
7. **Статистика.** `StatsModal` читает заметки месяца по одной (`io/noteStats`), считает итоги
   (`core/stats.summarizeMonth`), ✓-дни (`isAllTasksDone`) и серию (`currentStreak`; дни до начала месяца
   берутся только из `metadataCache`).

8. **Праздники.** После `onLayoutReady` и при изменении папки/порядка/шаблона `io/holidays.rebuildHolidays` читает
   имена `.md` в папке → `core/holidays.buildHolidayIndex` (ключ `MM-DD`). События `create/delete/rename` пересобирают
   индекс, только если путь внутри папки. Индекс используют: `sources/holidays` (класс `cwt-holiday`, 🎉 через CSS),
   превью, меню дня, `upcoming`, статистика и `io/notes.ruleContext` (условия `holiday` / `important`).
9. **Навигатор.** Клик по `.nav .title` перехватывается в `view` (capture) → `DateNavigatorModal` → `goToMonth`
   (`$set({displayedMonth})`) или `showStatistics`. Правый клик по заголовку по-прежнему открывает главное меню.
10. **Кнопка ⋯.** `view.placeMenuButton` ставит кнопку в `.right-nav` / перед заголовком / в отдельную строку по
    `menuPosition`; `MutationObserver` возвращает её, если Svelte перерисовал шапку.

## Правила безопасности

- Любой путь из настроек проходит через `core/paths.sanitizeVaultPath`: запрещены `..`, имена из одних точек,
  `C:`, `~`, управляющие символы, папка конфигурации (`.obsidian`) и пути длиннее 512 символов.
- Запись только через `app.vault` (внутри хранилища), без `fs`, сети, `eval` и `innerHTML`.
- Существующие заметки меняются только командой «Применить шаблон» и только после выбора пользователя.
- `data.json` считается недоверенным: неизвестные значения заменяются значениями по умолчанию, длины и количества ограничены.
- Регулярные выражения линейные; длинные/враждебные строки проверены тестами.
