/**
 * UI strings. English is the source of truth; Russian is a full translation.
 * Use `t("key", { var: value })`; `{var}` placeholders are replaced.
 */
import type { Language } from "./settings";

const en = {
  "view.title": "Calendar (Weekday Templates)",

  // commands
  "cmd.openView": "Open calendar view",
  "cmd.openYesterday": "Open yesterday's daily note",
  "cmd.openToday": "Open today's daily note",
  "cmd.openTomorrow": "Open tomorrow's daily note",
  "cmd.openWeekly": "Open this week's note",
  "cmd.openMonthly": "Open this month's note",
  "cmd.missingWeek": "Create missing daily notes until end of week",
  "cmd.missingMonth": "Create missing daily notes until end of month",
  "cmd.applyTemplate": "Apply weekday/event template to the current daily note",
  "cmd.importantList": "Show important days",
  "cmd.statistics": "Show statistics",
  "cmd.reveal": "Reveal active note in calendar",
  "cmd.prevDaily": "Open previous daily note",
  "cmd.nextDaily": "Open next daily note",
  "cmd.settings": "Open plugin settings",

  // menus
  "menu.header": "Calendar menu",
  "menu.missingDisplayedMonth": "Create missing daily notes for {month}",
  "menu.openMonthly": "Open monthly note for {month}",
  "menu.createNote": "Create daily note",
  "menu.openNote": "Open daily note",
  "menu.openInSplit": "Open in new pane",
  "menu.markImportant": "Mark as important…",
  "menu.editImportant": "Edit important day…",
  "menu.removeImportant": "Remove important mark",
  "menu.applyTemplate": "Apply template to this note…",
  "menu.delete": "Delete",

  // notices
  "notice.templateMissing": "Template '{path}' not found, trying the next one.",
  "notice.createFailed": "Unable to create '{path}': {error}",
  "notice.typeDisabled": "{type} notes are disabled in the plugin settings.",
  "notice.nothingMissing": "All daily notes from {from} to {to} already exist.",
  "notice.batchDone": "Created {created} of {total} daily notes.",
  "notice.batchFailed": "{failed} note(s) could not be created, see the developer console.",
  "notice.unsafePath":
    'Not created: folder "{folder}" with format "{format}" leads outside the vault or into the config folder. Check the plugin settings.',
  "notice.noAdjacentNote": "No earlier/later daily note found.",
  "notice.notADailyNote": "The active file is not a daily note of this plugin.",
  "notice.templateSkipped": "{file} left unchanged.",
  "notice.importDone": "Imported: {what}.",
  "notice.importNothing": "Neither Daily Notes nor Periodic Notes settings were found.",
  "notice.noActiveDailyNote": "The active file is not a daily note of this plugin.",
  "notice.templateApplied": "Template applied to {file}.",
  "notice.noTemplate": "No template is configured for {date}.",
  "notice.migrated":
    "Calendar (Weekday Templates): settings migrated to version 2. Note folders and formats are now configured in this plugin.",

  // confirm create
  "confirm.title": "New note",
  "confirm.text": "File {file} does not exist. Would you like to create it?",
  "confirm.create": "Create",
  "confirm.cancel": "Never mind",

  // batch modal
  "batch.title": "Create missing daily notes",
  "batch.summary": "{count} note(s) will be created:",
  "batch.create": "Create",
  "batch.cancel": "Cancel",
  "batch.empty": "empty note",
  "batch.existingSkipped":
    "Existing notes are never changed ({count} already exist and will be skipped).",
  "batch.running": "Creating…",

  // template sources
  "source.rule": 'special rule "{name}"',
  "source.weekday": "weekday template ({weekday})",
  "source.default": "default template",
  "source.none": "no template (empty note)",
  "source.missing": "skipped (file not found): {paths}",

  // preview
  "preview.title": "New note: {date}",
  "preview.template": "Template: {path}",
  "preview.reason": "Chosen by: {reason}",
  "preview.important": "Important: {title}",
  "preview.prepare": "Get ready: {title} in {days} d",
  "preview.empty": "The note will be empty.",
  "preview.more": "…",

  // important
  "important.title": "Important day",
  "important.name": "Title",
  "important.nameDesc": "Optional",
  "important.color": "Color",
  "important.prep": "Get ready N days before",
  "important.prepDesc": "Days before the date are softly highlighted (0 = off, max 30).",
  "important.save": "Save",
  "important.remove": "Remove mark",
  "important.cancel": "Cancel",
  "important.untitled": "Important day",
  "important.listTitle": "Important days",
  "important.listEmpty": "No important days yet. Right-click a day in the calendar to mark one.",
  "important.edit": "Edit",
  "important.past": "past",

  // upcoming
  "upcoming.title": "Upcoming important days",
  "upcoming.empty": "Nothing in the next {days} days.",
  "upcoming.today": "today",
  "upcoming.tomorrow": "tomorrow",
  "upcoming.inDays": "in {days} d",

  // apply template
  "apply.title": "Apply template to {file}",
  "apply.desc": "The note is not empty. Template: {path} ({reason}).",
  "apply.append": "Append to end",
  "apply.prepend": "Insert at beginning",
  "apply.replace": "Replace content",
  "apply.skip": "Skip (leave unchanged)",
  "apply.confirmReplaceTitle": "Replace note content?",
  "apply.confirmReplaceText":
    "The current content of {file} will be replaced by the template. This cannot be undone except with Ctrl+Z in the editor or file recovery.",

  // statistics
  "stats.title": "Statistics",
  "stats.prev": "Previous month",
  "stats.next": "Next month",
  "stats.colDay": "Day",
  "stats.colWords": "Words",
  "stats.colDone": "Done",
  "stats.colOpen": "Open",
  "stats.totalWords": "Total words",
  "stats.avgPerDay": "Average words per day",
  "stats.avgPerNote": "Average words per note",
  "stats.daysWithNotes": "Days with notes",
  "stats.tasks": "Tasks done / total",
  "stats.loading": "Counting…",
  "stats.allDone": "All tasks done",
  "stats.allDoneDays": "Days with all tasks done ✓",
  "stats.streak": "Current ✓ streak",
  "stats.streakValue": "{count} day(s)",

  // settings
  "settings.general": "General",
  "settings.language": "Language",
  "settings.languageDesc": "Interface language of this plugin. Auto follows Obsidian's language.",
  "settings.langAuto": "Auto",
  "settings.wordsPerDot": "Words per dot",
  "settings.wordsPerDotDesc": "How many words one dot under a day represents (max 5 dots).",
  "settings.weekStart": "Start week on",
  "settings.weekStartDesc": "Select 'Locale default' to use the default specified by moment.js.",
  "settings.localeDefault": "Locale default ({day})",
  "settings.confirm": "Confirm before creating a new note",
  "settings.confirmDesc": "Show a confirmation dialog before creating a single note by click.",
  "settings.preview": "Template preview on hover",
  "settings.previewDesc": "Hovering an empty day for ~0.4 s shows which template would be used.",
  "settings.upcoming": "Show upcoming important days",
  "settings.upcomingDesc": "A collapsible list under the calendar.",
  "settings.horizon": "Look-ahead for upcoming days",
  "settings.horizonDesc": "How many days ahead the list covers.",
  "settings.daily": "Daily notes",
  "settings.weekly": "Weekly notes",
  "settings.monthly": "Monthly notes",
  "settings.enabled": "Enabled",
  "settings.weeklyEnabledDesc":
    "Shows the week number column; click a week number to open its note.",
  "settings.monthlyEnabledDesc": "Open via the calendar menu or the command palette.",
  "settings.dailyEnabledDesc": "Clicking a day opens or creates its note.",
  "settings.folder": "Folder",
  "settings.unsafePath":
    'Path must stay inside the vault: no "..", drive letters or the config folder. Notes will not be created until this is fixed.',
  "settings.folderDesc": "New notes are created here. Empty = vault root.",
  "settings.format": "File name format",
  "settings.formatDesc": "moment.js format. May contain '/' for subfolders. Preview: {sample}",
  "settings.template": "Default template",
  "settings.templateDesc":
    "Used when no special rule (and, for daily notes, no weekday template) applies.",
  "settings.fileMissing": "⚠️ File not found, the next template in the chain will be used.",
  "settings.import": "Import from Daily Notes / Periodic Notes",
  "settings.importDesc":
    "Copy folder, format and template once from the core Daily Notes plugin and/or the Periodic Notes plugin, if they exist. Nothing is enabled or changed in those plugins.",
  "settings.importButton": "Import",
  "settings.weekdayTemplates": "Weekday templates (daily notes)",
  "settings.useWeekday": "Use a separate template for each weekday",
  "settings.useWeekdayDesc":
    "Uses the weekday of the note's date. Empty fields fall back to the default daily template.",
  "settings.weekdayTemplate": "{weekday} template",
  "settings.weekdayTemplateDesc": "Path to a markdown file. Empty = default template.",
  "settings.rules": "Special template rules",
  "settings.rulesDesc":
    "Checked top to bottom; the first enabled matching rule wins (if its file is missing, the next candidate is used). Weekly/monthly notes are matched on the first day of the period.",
  "settings.addRule": "Add rule",
  "settings.ruleName": "Name",
  "settings.ruleEnabled": "Enabled",
  "settings.ruleUp": "Move up",
  "settings.ruleDown": "Move down",
  "settings.ruleDelete": "Delete rule",
  "settings.ruleCondition": "Condition",
  "settings.ruleTemplate": "Template file",
  "settings.ruleAppliesTo": "Applies to",
  "settings.ruleInvalid": "⚠️ The condition is incomplete, the rule is ignored.",
  "settings.advanced": "Advanced",
  "settings.locale": "Override locale",
  "settings.localeDesc": "Use a moment.js locale different from the default.",
  "settings.localeSystem": "Same as system ({locale})",

  // conditions
  "cond.date": "Specific date",
  "cond.annual": "Every year on",
  "cond.range": "Date range",
  "cond.nthWeekday": "N-th weekday of month",
  "cond.weekParity": "Even / odd ISO week",
  "cond.from": "from",
  "cond.to": "to",
  "cond.monthDayPlaceholder": "MM-DD",
  "cond.nth1": "1st",
  "cond.nth2": "2nd",
  "cond.nth3": "3rd",
  "cond.nth4": "4th",
  "cond.nth5": "5th",
  "cond.nthLast": "last",
  "cond.even": "even week",
  "cond.odd": "odd week",

  "type.day": "Daily",
  "type.week": "Weekly",
  "type.month": "Monthly",

  "color.red": "Red",
  "color.orange": "Orange",
  "color.yellow": "Yellow",
  "color.green": "Green",
  "color.cyan": "Cyan",
  "color.blue": "Blue",
  "color.purple": "Purple",
  "color.pink": "Pink",
};

export type I18nKey = keyof typeof en;

const ru: Record<I18nKey, string> = {
  "view.title": "Календарь (шаблоны по дням недели)",

  "cmd.openView": "Открыть календарь",
  "cmd.openYesterday": "Открыть вчерашнюю ежедневную заметку",
  "cmd.openToday": "Открыть сегодняшнюю ежедневную заметку",
  "cmd.openTomorrow": "Открыть завтрашнюю ежедневную заметку",
  "cmd.openWeekly": "Открыть заметку этой недели",
  "cmd.openMonthly": "Открыть заметку этого месяца",
  "cmd.missingWeek": "Создать недостающие ежедневные заметки до конца недели",
  "cmd.missingMonth": "Создать недостающие ежедневные заметки до конца месяца",
  "cmd.applyTemplate": "Применить шаблон дня недели/события к текущей ежедневной заметке",
  "cmd.importantList": "Показать важные дни",
  "cmd.statistics": "Показать статистику",
  "cmd.reveal": "Показать активную заметку в календаре",
  "cmd.prevDaily": "Открыть предыдущую ежедневную заметку",
  "cmd.nextDaily": "Открыть следующую ежедневную заметку",
  "cmd.settings": "Открыть настройки плагина",

  "menu.header": "Меню календаря",
  "menu.missingDisplayedMonth": "Создать недостающие заметки за {month}",
  "menu.openMonthly": "Открыть заметку месяца: {month}",
  "menu.createNote": "Создать ежедневную заметку",
  "menu.openNote": "Открыть ежедневную заметку",
  "menu.openInSplit": "Открыть в новой панели",
  "menu.markImportant": "Пометить как важный…",
  "menu.editImportant": "Изменить важный день…",
  "menu.removeImportant": "Снять пометку «важный»",
  "menu.applyTemplate": "Применить шаблон к этой заметке…",
  "menu.delete": "Удалить",

  "notice.templateMissing": "Шаблон «{path}» не найден, берём следующий.",
  "notice.createFailed": "Не удалось создать «{path}»: {error}",
  "notice.typeDisabled": "{type} заметки выключены в настройках плагина.",
  "notice.nothingMissing": "Все ежедневные заметки с {from} по {to} уже есть.",
  "notice.batchDone": "Создано заметок: {created} из {total}.",
  "notice.batchFailed": "Не удалось создать заметок: {failed}, подробности в консоли разработчика.",
  "notice.unsafePath":
    "Заметка не создана: папка «{folder}» с форматом «{format}» ведёт за пределы хранилища или в папку настроек. Проверьте настройки плагина.",
  "notice.noAdjacentNote": "Более ранней/поздней ежедневной заметки нет.",
  "notice.notADailyNote": "Активный файл не является ежедневной заметкой этого плагина.",
  "notice.templateSkipped": "{file}: без изменений.",
  "notice.importDone": "Импортировано: {what}.",
  "notice.importNothing": "Настройки Daily Notes и Periodic Notes не найдены.",
  "notice.noActiveDailyNote": "Активный файл не является ежедневной заметкой этого плагина.",
  "notice.templateApplied": "Шаблон применён к {file}.",
  "notice.noTemplate": "Для {date} не настроен ни один шаблон.",
  "notice.migrated":
    "Calendar (Weekday Templates): настройки перенесены в версию 2. Папки и форматы заметок теперь задаются в этом плагине.",

  "confirm.title": "Новая заметка",
  "confirm.text": "Файла {file} нет. Создать его?",
  "confirm.create": "Создать",
  "confirm.cancel": "Отмена",

  "batch.title": "Создать недостающие ежедневные заметки",
  "batch.summary": "Будет создано заметок: {count}",
  "batch.create": "Создать",
  "batch.cancel": "Отмена",
  "batch.empty": "пустая заметка",
  "batch.existingSkipped":
    "Существующие заметки не меняются (уже есть: {count}, они будут пропущены).",
  "batch.running": "Создание…",

  "source.rule": "особое правило «{name}»",
  "source.weekday": "шаблон дня недели ({weekday})",
  "source.default": "шаблон по умолчанию",
  "source.none": "без шаблона (пустая заметка)",
  "source.missing": "пропущены (файл не найден): {paths}",

  "preview.title": "Новая заметка: {date}",
  "preview.template": "Шаблон: {path}",
  "preview.reason": "Выбран: {reason}",
  "preview.important": "Важный день: {title}",
  "preview.prepare": "Подготовка: {title} через {days} дн.",
  "preview.empty": "Заметка будет пустой.",
  "preview.more": "…",

  "important.title": "Важный день",
  "important.name": "Название",
  "important.nameDesc": "Необязательно",
  "important.color": "Цвет",
  "important.prep": "Подготовиться за N дней",
  "important.prepDesc": "Дни перед датой мягко подсвечиваются (0 — выкл., максимум 30).",
  "important.save": "Сохранить",
  "important.remove": "Снять пометку",
  "important.cancel": "Отмена",
  "important.untitled": "Важный день",
  "important.listTitle": "Важные дни",
  "important.listEmpty": "Важных дней пока нет. Нажмите ПКМ на дне в календаре, чтобы пометить.",
  "important.edit": "Изменить",
  "important.past": "прошёл",

  "upcoming.title": "Ближайшие важные дни",
  "upcoming.empty": "В ближайшие {days} дн. ничего нет.",
  "upcoming.today": "сегодня",
  "upcoming.tomorrow": "завтра",
  "upcoming.inDays": "через {days} дн.",

  "apply.title": "Применить шаблон к {file}",
  "apply.desc": "Заметка не пустая. Шаблон: {path} ({reason}).",
  "apply.append": "Дописать в конец",
  "apply.prepend": "Вставить в начало",
  "apply.replace": "Заменить содержимое",
  "apply.skip": "Пропустить (не менять)",
  "apply.confirmReplaceTitle": "Заменить содержимое заметки?",
  "apply.confirmReplaceText":
    "Текущее содержимое {file} будет заменено шаблоном. Отменить можно только через Ctrl+Z в редакторе или восстановление файлов.",

  "stats.title": "Статистика",
  "stats.prev": "Предыдущий месяц",
  "stats.next": "Следующий месяц",
  "stats.colDay": "День",
  "stats.colWords": "Слов",
  "stats.colDone": "Готово",
  "stats.colOpen": "Осталось",
  "stats.totalWords": "Всего слов",
  "stats.avgPerDay": "В среднем слов в день",
  "stats.avgPerNote": "В среднем слов на заметку",
  "stats.daysWithNotes": "Дней с заметками",
  "stats.tasks": "Задач выполнено / всего",
  "stats.loading": "Подсчёт…",
  "stats.allDone": "Все задачи выполнены",
  "stats.allDoneDays": "Дней, где выполнены все задачи ✓",
  "stats.streak": "Текущая серия ✓",
  "stats.streakValue": "дней: {count}",

  "settings.general": "Общие",
  "settings.language": "Язык",
  "settings.languageDesc": "Язык интерфейса плагина. «Авто» — как в Obsidian.",
  "settings.langAuto": "Авто",
  "settings.wordsPerDot": "Слов на точку",
  "settings.wordsPerDotDesc": "Сколько слов обозначает одна точка под днём (не больше 5 точек).",
  "settings.weekStart": "Начало недели",
  "settings.weekStartDesc": "«По локали» — как задано в moment.js.",
  "settings.localeDefault": "По локали ({day})",
  "settings.confirm": "Подтверждать создание новой заметки",
  "settings.confirmDesc": "Показывать диалог перед созданием одной заметки по клику.",
  "settings.preview": "Предпросмотр шаблона при наведении",
  "settings.previewDesc":
    "При наведении на пустой день (~0,4 с) показывает, какой шаблон будет применён.",
  "settings.upcoming": "Показывать ближайшие важные дни",
  "settings.upcomingDesc": "Сворачиваемый список под календарём.",
  "settings.horizon": "Горизонт списка",
  "settings.horizonDesc": "На сколько дней вперёд смотреть.",
  "settings.daily": "Ежедневные заметки",
  "settings.weekly": "Недельные заметки",
  "settings.monthly": "Месячные заметки",
  "settings.enabled": "Включено",
  "settings.weeklyEnabledDesc":
    "Показывает колонку номеров недель; клик по номеру открывает заметку недели.",
  "settings.monthlyEnabledDesc": "Открывается из меню календаря или палитры команд.",
  "settings.dailyEnabledDesc": "Клик по дню открывает или создаёт его заметку.",
  "settings.folder": "Папка",
  "settings.unsafePath":
    "Путь должен оставаться внутри хранилища: без «..», букв дисков и папки настроек. Пока это не исправлено, заметки создаваться не будут.",
  "settings.folderDesc": "Новые заметки создаются здесь. Пусто — корень хранилища.",
  "settings.format": "Формат имени файла",
  "settings.formatDesc": "Формат moment.js. Можно использовать «/» для подпапок. Пример: {sample}",
  "settings.template": "Шаблон по умолчанию",
  "settings.templateDesc":
    "Используется, если не подошло особое правило (и, для ежедневных, шаблон дня недели).",
  "settings.fileMissing": "⚠️ Файл не найден, будет взят следующий шаблон в цепочке.",
  "settings.import": "Импорт из Daily Notes / Periodic Notes",
  "settings.importDesc":
    "Разово скопировать папку, формат и шаблон из встроенного плагина Daily Notes и/или Periodic Notes, если они есть. В тех плагинах ничего не включается и не меняется.",
  "settings.importButton": "Импортировать",
  "settings.weekdayTemplates": "Шаблоны по дням недели (ежедневные)",
  "settings.useWeekday": "Отдельный шаблон для каждого дня недели",
  "settings.useWeekdayDesc": "Берётся день недели даты заметки. Пустые поля — шаблон по умолчанию.",
  "settings.weekdayTemplate": "Шаблон: {weekday}",
  "settings.weekdayTemplateDesc": "Путь к markdown-файлу. Пусто — шаблон по умолчанию.",
  "settings.rules": "Особые правила шаблонов",
  "settings.rulesDesc":
    "Проверяются сверху вниз; побеждает первое включённое подходящее правило (если его файла нет — следующий кандидат). Для недельных/месячных заметок условие проверяется по первому дню периода.",
  "settings.addRule": "Добавить правило",
  "settings.ruleName": "Название",
  "settings.ruleEnabled": "Включено",
  "settings.ruleUp": "Выше",
  "settings.ruleDown": "Ниже",
  "settings.ruleDelete": "Удалить правило",
  "settings.ruleCondition": "Условие",
  "settings.ruleTemplate": "Файл шаблона",
  "settings.ruleAppliesTo": "Для заметок",
  "settings.ruleInvalid": "⚠️ Условие заполнено не полностью, правило игнорируется.",
  "settings.advanced": "Дополнительно",
  "settings.locale": "Переопределить локаль",
  "settings.localeDesc": "Использовать другую локаль moment.js.",
  "settings.localeSystem": "Как в системе ({locale})",

  "cond.date": "Конкретная дата",
  "cond.annual": "Ежегодно",
  "cond.range": "Диапазон дат",
  "cond.nthWeekday": "N-й день недели месяца",
  "cond.weekParity": "Чётная / нечётная ISO-неделя",
  "cond.from": "с",
  "cond.to": "по",
  "cond.monthDayPlaceholder": "ММ-ДД",
  "cond.nth1": "1-й",
  "cond.nth2": "2-й",
  "cond.nth3": "3-й",
  "cond.nth4": "4-й",
  "cond.nth5": "5-й",
  "cond.nthLast": "последний",
  "cond.even": "чётная неделя",
  "cond.odd": "нечётная неделя",

  "type.day": "Ежедневные",
  "type.week": "Недельные",
  "type.month": "Месячные",

  "color.red": "Красный",
  "color.orange": "Оранжевый",
  "color.yellow": "Жёлтый",
  "color.green": "Зелёный",
  "color.cyan": "Бирюзовый",
  "color.blue": "Синий",
  "color.purple": "Фиолетовый",
  "color.pink": "Розовый",
};

export const DICTIONARIES: Record<"en" | "ru", Record<I18nKey, string>> = { en, ru };

let current: "en" | "ru" = "en";

/** Obsidian stores its UI language in localStorage under "language". */
function detectObsidianLanguage(): string {
  try {
    return (typeof window !== "undefined" && window.localStorage?.getItem("language")) || "";
  } catch (_e) {
    return "";
  }
}

export function resolveLanguage(setting: Language, detected?: string): "en" | "ru" {
  if (setting === "en" || setting === "ru") {
    return setting;
  }
  const lang = (detected ?? detectObsidianLanguage()).toLowerCase();
  return lang.startsWith("ru") ? "ru" : "en";
}

export function setLanguage(setting: Language): void {
  current = resolveLanguage(setting);
}

export function getLanguage(): "en" | "ru" {
  return current;
}

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[current][key] ?? en[key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    vars[name] !== undefined ? String(vars[name]) : m,
  );
}
