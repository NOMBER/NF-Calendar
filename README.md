# NF-Calendar

**English** · [Русский](README.ru.md) · [More plugins by NomberProjects](https://nomberobsidian.github.io/)

A calendar view for [Obsidian](https://obsidian.md) with built-in daily, weekly and monthly notes and
rule-based templates: per weekday, per date, per date range, "last Friday of the month", even/odd weeks and more.

This is a fork of [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) by **Liam Cain**, released under
the MIT license (see [LICENSE](LICENSE)). All credit for the original calendar view goes to him; the original README is
kept in [README.original.md](README.original.md).

- Plugin id: `nf-calendar`, version 2.11.0
- Requires Obsidian **1.4.10+**, works on desktop and mobile (`isDesktopOnly: false`)
- Interface in **English and Russian**

<!-- Screenshots: none yet. Add images of this fork here once available. -->

## One plugin instead of three

Since 2.0 this plugin replaces **Calendar + the core Daily Notes plugin + Periodic Notes** (weekly / monthly part).
It keeps its own settings for daily, weekly and monthly notes and finds and creates the notes itself. It does not read
or enable other plugins, except for the explicit **Import from Daily Notes / Periodic Notes** button and a one-time
migration from 1.x.

## Features

- **Calendar view.** Comes from the original plugin: word-count dots, task indicators, week numbers.
  - Click a day to open or create its daily note; Ctrl/Cmd+click opens it in a new pane.
  - Click a week number to open the weekly note.
- **Daily, weekly and monthly notes.** Each type has its own folder, file name format (moment.js) and default template,
  and can be turned on or off.
- **Template selection.** For a daily note the plugin takes:
  1. the first enabled **special rule** that matches the date (top to bottom);
  2. otherwise the **weekday template** (one per weekday);
  3. otherwise the **default template**.

  Weekly and monthly notes check rules (if the rule is enabled for that note type) against the first day of the period, then
  use the type's default template. If a template file is missing, the plugin shows a notice and moves on to the next candidate.
  Templates are picked by the **note's date**, not by today.
- **Special rules.** Rules are ordered and can be renamed, enabled or disabled, moved up or down and deleted. Each has a
  condition, the note types it applies to (daily / weekly / monthly) and a template file. Conditions are picked from a
  compact grouped list:
  - **Dates:** every year on a day + month (the main type: birthdays, holidays); a date range (vacation); a one-off date
    `YYYY-MM-DD` (kept for old rules);
  - **Month:** a range of days of the month (`1–7`, or `25–5` wrapping over the month end); the last N days of the month;
    the first / last day of the month; the first / last day of a quarter;
  - **Weekdays & cycles:** several weekdays in one rule (with Mon–Fri / Sat–Sun presets); the N-th weekday of the month
    (1st–5th or **last**); week N of the month (or the last week); even or odd ISO week; every N days from a chosen date;
  - **Marks:** a holiday from the holidays folder falls on the day; the day is marked important.
- **Quick date navigator.** Click the month title (e.g. "Nov 2026"): a dialog with a year switcher (‹ › , typed year or a
  12-year grid), a 12-month grid and an exact-day field. A switch chooses whether a month click opens the calendar on that
  month or that month's statistics. The day field shows whether the note exists and opens or creates it. Works on mobile
  (it is a regular modal with finger-sized buttons). Right-click on the title still opens the main menu.
- **2.11.0.** Daily note folders dropdown next to Organize; Organize offers “Also store new notes this way” (on by default). Reverse organize to year-only or flat; optional cleanup of empty year/month folders. Go to date → Open statistics switches **in the same modal** (Back returns); fixed closed random-collapse overlay stealing clicks.
- **2.10.0.** Create missing daily notes from start of week / for the whole week; organize into year **or** year/month folders (`folder/2026/11/…`); Daily note folders setting (flat / year / year-month). **Every ⋯ and modal action is also a command** (no default hotkeys) — assign them in Obsidian → Settings → Hotkeys. Statistics opens reliably from the menu; Upcoming filter no longer shifts the header when expanded.
- **2.9.2.** Upcoming filter is a button + Obsidian menu (native `<select>` inside `<summary>` could not open after 2.9.1). Fixed-width disclosure chevron so the title no longer shifts on expand/collapse.
- **2.9.1.** Collapse chevron restored; filter hidden while collapsed; setting to hide the filter control.
- **2.9.0.** Several important events on one day (shared colour, separate rows in Upcoming). Right-click /
  long-press an Upcoming row → Complete / dismiss (removes a user mark or hides a holiday for that day).
  Compact All / Holidays / Important filter next to the Upcoming header (optional setting to hide it).
- **2.8.0.** Startup tab position (left after pinned tabs / right); collapsible random-note box in "Go to date" with
  its own "Open" button; "Date field format" (DD.MM.YYYY, YYYY.MM.DD, MM.DD.YYYY with `.`, `-` or `/`) for every typed
  date; "Create missing daily notes until end of week/month" works from the open daily note (toggle "Create relative to
  the open note", on by default) and the confirmation shows the range and count.
- **Random daily note** (2.6.0, reworked in 2.7.0). In the date navigator the "Random note" button sits next to "Open
  statistics"; right below it a labelled box picks the period: all notes, the chosen year, a month of that year, the last
  N days or a date range (from–to, an empty end is open); optional "Skip empty" (a note with only front matter, headings and empty
  list/task markers counts as empty). Only existing daily notes are used (flat folder, year folders and mixed layouts; a
  day with duplicate files counts once). The note opened last is not repeated right away if there is another one. With
  no notes in the period a notice says so. File contents are read only with "Skip empty", and only for drawn candidates.
  Command palette: "Open random daily note" uses the defaults from Settings → "Random note" (period, skip empty), which
  are also the navigator's starting values.
- **Holidays folder.** Point the plugin to a folder (e.g. `Meta/Dates`) whose note names start with a date:
  `13.03 Birthday`, `03-13 …`, `13/03 …`, `1999-03-13 - Natalia's birthday`, `1000-09-01 Knowledge Day` (the separator
  after the date is optional). Two-part dates are read by the **Day first / Month first** setting; `YYYY-MM-DD` is always
  unambiguous; an optional custom pattern (`DD_MM`, `YYYY.MM.DD`, …) is also supported. Holidays match every year by day
  and month.
  - The calendar shows 🎉 on those days; hovering shows the holiday names (and age when the note has a real year ≥ 1900,
    so placeholder years like `1000` show no age); clicking the 🎉 corner or the day's context menu lists the holiday
    notes and opens them.
  - Holidays also appear in **Upcoming**, can drive special rules (the "holiday" condition) and are shown in statistics.
  - The index is cached and rebuilt only when files in that folder are created, deleted or renamed, or the setting changes.
  - Names that do not start with a recognizable date are counted in settings.
- **⋯ menu position.** Setting: right or left of "‹ Today ›", before the month title, or a separate row above the calendar, or
  hidden (2.7.0): everything stays in the command palette, right-click on the month title still opens the menu, settings
  are in Obsidian Settings → Community plugins → NF-Calendar.
- **Settings navigation** (2.7.0): a compact sticky bar of section links at the top of the settings tab; changing a
  setting no longer scrolls the tab back to the top.
- **Commands** (command palette, plus the **⋯ menu** in the calendar header and right-click on the month title):
  - Open calendar view
  - Open yesterday's / today's / tomorrow's daily note
  - Open previous / next daily note
  - Open this week's note / this month's note
  - Create missing daily notes until end of week / until end of month
  - Apply weekday/event template to the current daily note
  - Show important days
  - Show statistics
  - Reveal active note in calendar

  The ⋯ menu also has "Open plugin settings" and, for a future month shown in the calendar, "Create missing daily notes for
  &lt;month&gt;". Two checkable items switch grid marks on/off: "Show holidays in the calendar" (🎉 from the holidays folder)
  and "Highlight important days in the calendar" (rings and get-ready highlight). They change only the display; rules,
  statistics and the "Upcoming" list are not affected. The same switches are in Settings.

  **Customizing the ⋯ menu** (2.6.0): at the bottom of Settings, section "⋯ menu", lists every item with a "show" toggle
  and ↑/↓ buttons; "Reset to default" restores all items in the default order. Separators are drawn between item groups
  automatically. Items that only apply sometimes (previous/next, apply template, weekly/monthly note, the shown future
  month) still appear only when they apply. Hidden items stay in the command palette if they are commands (the two
  display switches are not commands, they stay in Settings). Lock-out protection: if nothing would be shown, the menu
  shows "Open plugin settings", so ⋯ always opens something and the settings stay reachable.
- **Batch creation of missing notes.**
  - Starts from today and first shows a dialog listing the dates, the chosen templates and the reason for each choice.
  - Existing notes are **always skipped and never changed**. The dialog shows how many will be skipped, and a note that
    appears while the batch runs (sync, a click) is skipped too.
  - Notes are created one by one, and a second run is ignored while one is in progress. A summary notice follows.
- **Apply a template to an existing note.** Available from the command, the ⋯ menu and the day's context menu.
  - The template is chosen by the same rules, using the date of the selected day or of the open note's file name.
  - An empty note is filled at once.
  - For a non-empty note you choose: **Append to end**, **Insert at beginning** (after the note's frontmatter),
    **Replace content** (asks for confirmation) or **Skip (leave unchanged)**. Skip is the default button, and Esc does the same.
- **Important days.**
  - Right-click a day → "Mark as important…": one or more event titles, a shared color from a theme-aware palette or any custom colour from the colour picker, and "prepare N days before" (0–30). Add further events via "Add another event…".
  - The day gets a colored outline and the preparation days are softly highlighted.
  - A collapsible **Upcoming important days** list under the calendar opens the note on click. Filter All / Holidays / Important days; right-click (or long-press) a row → Complete / dismiss.
  - Important days are stored in the plugin's `data.json`, so they need no note.
- **Template preview.** Hover an empty day for about 0.4 s to see:
  - which template would be used and why, and which files are missing;
  - the important day, if any;
  - the first ~10 lines of the template, without placeholder substitution.

  It can be turned off in settings.
- **Monthly statistics.** A month view with arrows.
  - **Per day:** words, done and open tasks (`- [x]` / `- [ ]`) and the important-day mark; click a row to open the note.
  - **✓** next to a day means the note has at least one task and all of its tasks are done.
  - **Summary:** total words, average per day and per note, days with notes, tasks done / total, **days with ✓** and the
    **current ✓ streak** (consecutive all-done days).
  - **Streak:** in the current month it counts up to today (an unfinished today does not break it); in a past month it counts up to
    the month's last day; in a future month it is not shown. It can reach back into earlier months, up to 366 days, using
    `metadataCache`.
  - Notes are read one by one, so the UI is not blocked.
  - **Table / Charts** switch. Charts (pure SVG, theme colors, hover tooltips): words per day, done vs open tasks,
    cumulative words (bars or line), and a donut of days with ✓ / without ✓ / without a note. The chosen view, metric and
    chart type are remembered.
- **Previous / next daily note.** Jumps to the nearest *existing* daily note before or after the open one; gaps are
  ignored and nothing is created. These items appear in the ⋯ menu when a daily note is open.
- **`{{carryover}}`** (daily notes only) inserts the open tasks of the nearest previous daily note.
  - Looks back up to 31 days and takes at most 200 tasks.
  - Indentation is kept, tasks inside code blocks are skipped and the previous note is not modified.
  - Left empty during batch creation, so the same tasks are not copied into every future note.
- **i18n.** English and Russian, set with **Language: Auto / English / Русский** (Auto follows Obsidian's language).

### Template placeholders

All placeholders are computed relative to the **note's date** (the first day of the period for weekly and monthly notes):

| Placeholder | Result |
| --- | --- |
| `{{title}}`, `{{date}}` | the note's file name (formatted with the note type's format) |
| `{{time}}` | current time, `HH:mm` |
| `{{date:FMT}}`, `{{time:FMT}}` | the note date with a moment.js format, e.g. `{{date:dddd, D MMMM}}` |
| `{{date+1d:FMT}}`, `{{date-2w}}` | date arithmetic; units `y q m w d h s` |
| `{{yesterday}}`, `{{tomorrow}}` | previous / next day in the note format |
| `{{monday:FMT}}` … `{{sunday:FMT}}` | that weekday of the note's week (locale aware) |
| `{{carryover}}` | open tasks from the previous daily note (see above) |

Anything else, including Templater's `<% … %>`, is left untouched. Substituted values are inserted literally (`$&` and
similar sequences are not interpreted), and placeholders inside carried-over text are not expanded.

## Installation

The plugin is **not yet in the Obsidian community plugin catalog**. Install it manually:

0. **Upgrading from 2.3.x or older** (plugin id `calendar-weekday-templates`, named "Calendar (Weekday Templates)"): disable it and delete the folder `<your vault>/.obsidian/plugins/calendar-weekday-templates/` first. Since 2.4.0 the plugin id is `nf-calendar`; old settings are not migrated, so set them again.
1. Take `dist/nf-calendar.zip` (or `main.js`, `manifest.json` and `styles.css` from `dist/`).
2. Unzip it into `<your vault>/.obsidian/plugins/`. You should get a folder `nf-calendar/` with the three files.
3. Restart Obsidian, or click "Reload plugins" under Community plugins, then enable **NF-Calendar**.
4. It is best to disable the original Calendar. Once this plugin is set up, Daily Notes and Periodic Notes can be disabled too.

### Upgrading from 1.x

2.0 changed the settings format (`settingsVersion: 2`). On the first start after the upgrade the plugin **once** imports
the folder, format and template from the core Daily Notes and Periodic Notes plugins (if they were configured), plus the 1.x
weekday templates. It then saves the new settings and shows a notice. After that it no longer reads other plugins' settings. On a fresh
install the import only runs when you click **Import from Daily Notes / Periodic Notes**.

## Configuration

- **General:**
  - Language;
  - what the dots under days mean: note exists (default since 2.4.0), done tasks (one dot per task up to 5, filled = done), word count (1–5 dots at 1 / 250 / 500 / 1000 / 2000 words), or no dots;
  - start of the week (locale default or a fixed day);
  - confirm before creating a note by click;
  - template preview on hover;
  - show upcoming important days and the look-ahead window.
- **Daily / Weekly / Monthly notes:**
  - enabled;
  - folder (empty = vault root);
  - file name format (moment.js, may contain `/` for subfolders; a live sample is shown);
  - default template.

  Default formats are `YYYY-MM-DD`, `gggg-[W]ww` and `YYYY-MM`. A missing template file or an unsafe path is highlighted.
- **Weekday templates (daily notes):** one template per weekday, listed in your week-start order. Empty = default template.
- **Special template rules:** see Features.
- **Advanced:** override the moment.js locale.

### Rule examples

| Rule | Condition | Applies to | Template |
| --- | --- | --- | --- |
| Mom's birthday | Every year on `05-14` | Daily | `Templates/Birthday.md` |
| Vacation | Date range `2026-07-01` → `2026-07-14` | Daily | `Templates/Vacation.md` |
| Monthly review | N-th weekday: last Friday | Daily | `Templates/Review.md` |
| Sprint planning | Even ISO week | Weekly | `Templates/Sprint.md` |
| Release day | Specific date `2026-12-01` | Daily | `Templates/Release.md` |
| Payday prep | Last 3 days of the month | Daily | `Templates/Budget.md` |
| Workout | Weekdays Mon, Wed, Fri | Daily | `Templates/Gym.md` |
| Quarter review | Last day of quarter | Daily | `Templates/Quarter.md` |
| Watering | Every 3 days from `2026-11-01` | Daily | `Templates/Plants.md` |
| Holiday | Holiday from folder | Daily | `Templates/Holiday.md` |

Rules are checked top to bottom, so place more specific rules (a single date) above broader ones (a range).

## Open daily note on startup

Setting in the Daily notes section, **off** by default. When it is on and Obsidian starts, NF-Calendar opens today's note.
If the note is missing, NF-Calendar creates it the usual way, without the confirmation dialog: special rules, then weekday template, then default; year folders are respected.
Before creating, it checks every possible path on disk and never overwrites anything.
If today's note is already open in a tab, that tab is focused instead of opening a second one. Enabling or reloading the plugin while Obsidian is running does not open anything.

With this option on you can **turn the core Daily notes plugin off completely**. If you keep it, turn off its own "Open daily note on startup" option,
otherwise both plugins open or create today's note and you may get duplicates, for example a flat copy next to the note in the year folder.

## Organize daily notes by year

Command **Organize daily notes by year** (command palette and Settings → Daily notes; not in the ⋯ menu since 2.5.1) moves daily notes that lie
directly in the daily folder into year subfolders: `Daily/2026-10-30.md` → `Daily/2026/2026-10-30.md`.

- **Make a backup of your vault before the first run.**
- A preview opens first: how many notes per year, and what is skipped and why. Nothing moves until you press **Move**.
- Only `.md` files directly in the daily folder whose name matches the daily format are moved. Files in subfolders,
  other file types, unrecognized names and anything in the config folder (`.obsidian`) are never touched.
- If the target file already exists, the note is skipped. Nothing is overwritten.
- Files are moved with Obsidian's `fileManager.renameFile`, so links are updated if "Automatically update internal links" is on.
- **Undo last organize** moves the notes back. The list of moves is kept in `data.json`. A note is skipped if it was moved
  again or if its old place is taken.
- Afterwards the plugin offers to turn on **Keep new daily notes in year folders** (setting in the Daily section). With it on, new daily notes
  go to `Daily/YYYY/`.
- The plugin finds a note in either layout: the expected path first, then the other layout, then by date in any subfolder. Flat, year and
  mixed folders all work, so the calendar does not break after organizing.
- **A flat duplicate appeared (e.g. `Daily/2026-11-05.md` next to `Daily/2026/2026-11-05.md`)?** NF-Calendar does not create it:
  with year folders on, it creates notes only in `Daily/YYYY/`, and before creating it checks every possible path on disk.
  Usually the core **Daily notes** plugin (option "Open daily note on startup") or **Periodic Notes** creates it, because they do not know about year folders.
  NF-Calendar shows a notice naming both files and keeps opening the one in the year folder.
  To fix it, turn off the other plugin, or at least its startup option; the calendar does not need it.
  Delete the flat file if it is empty. If your real note looks lost, check the year folder, the system trash or `.trash`, and File recovery (core plugin).
- Weekly and monthly notes have no organize command and stay where they are. The year folder setting exists only for daily notes.

## Templater compatibility

- The plugin does not run Templater code. `<% … %>` is copied into the new note unchanged. If Templater's
  **"Trigger Templater on new file creation"** is on, Templater processes the new note itself.
- **Apply template** writes through `vault.process`, so Templater code is **not executed** there. Run Templater's
  "Replace templates in the active file" command afterwards if you need it.
- In text taken from older notes by `{{carryover}}`, `<%` is escaped as `<\%` so that Templater does not run it.

## Limitations

- Command names in the command palette use the language chosen when the plugin loaded. Reload the plugin after changing the
  language.
- "Insert at beginning" with a template that has its own frontmatter can produce a second `---` block inside the note.
- The Periodic Notes 1.0 beta format (calendar sets) is not supported by the import; Periodic Notes 0.x and the core Daily
  Notes plugin are.
- Quarterly and yearly notes are not supported.
- The plugin has been tested with unit tests and a mocked Obsidian API (see Development). Please report anything that
  behaves differently in a real vault.

## Security

What has been checked and enforced in the code (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), in Russian):

- **Paths stay inside the vault.** Every folder, file name format and template path goes through one check
  (`src/core/paths.ts`). The check rejects:
  - `..` and dot-only segments;
  - drive letters (`C:`) and `~`;
  - control characters and over-long paths;
  - paths inside the config folder (`.obsidian`).

  This also covers formats like `[../]YYYY`. An unsafe path blocks note creation with a notice, and settings show a warning.
- **Vault API only.** The plugin reads and writes only through Obsidian's vault API. The release bundle has **no network
  access** (`fetch` / XHR), **no `eval` / `new Function`**, **no `innerHTML`** and no `fs` / `child_process` usage.
- **No silent overwrites.**
  - Existing notes are never overwritten.
  - Note creation re-checks the path right before writing, and concurrent creations of the same note are merged.
  - The only way to change an existing note is "Apply template", after you pick an action; Replace also asks for confirmation.
- **`data.json` validation.** On load, types, allowed values and limits are checked: week start, locale id, dots mode, custom colours (`#rrggbb` only),
  rule conditions, important days, string lengths and number of rules (200) and important days (5000).
- **Template injection / ReDoS.** Placeholder patterns are linear, values are inserted literally, and carried-over text is not
  re-expanded. There are tests for this, including timing tests on hostile input.
- **Cleanup.** Listeners, timers and open dialogs are released when the plugin unloads.

## Known issues / dependency advisories

Output of `npm audit` on 2026-11-03 for this repository:
**48 vulnerabilities (5 low, 35 moderate, 8 high, 0 critical).** Of the packages, 10 are production dependencies and 429 are dev-only.

What actually ships in `main.js`: the Svelte 3 runtime and `obsidian-calendar-ui`. `obsidian` and `moment` are provided
by Obsidian at runtime, and everything else is build or test tooling.

- **svelte 3.35** (pulled in by `obsidian-calendar-ui`, which needs Svelte 3). `npm audit` reports **no fix** within
  Svelte 3; the fixes need Svelte 4/5, which would mean rewriting the calendar UI.
  - Most advisories concern **server-side rendering (SSR)**: GHSA-wv8q-r932-8hc7, GHSA-8266-84wp-wv5c, GHSA-crpf-4hrx-3jrp,
    GHSA-m56q-vw4c-c2cp, GHSA-f7gr-6p89-r883, GHSA-phwv-c562-gvmh and GHSA-pr6f-5x2q-rwfp. The plugin renders only on the client,
    inside Obsidian, so SSR is not used.
  - GHSA-gw32-9rmw-qwww (high) is about `<textarea bind:value>`. Neither this plugin nor `obsidian-calendar-ui` uses a textarea binding.
  - GHSA-rcqx-6q8c-2c42 (moderate, DOM clobbering of internal framework state) is not SSR-specific and has **not been fixed**
    here. The calendar renders data from your own vault and settings only, but this stays open until the UI moves to a newer Svelte.
- **moment** (GHSA-4p3w-j4w9-5jqw, path traversal via a crafted locale name, no fix in the installed range).
  - Mitigated: the plugin passes only locale ids matching `^[a-z]{2,3}(-[a-z0-9]{2,8}){0,2}$` to moment, and other values from
    `data.json` fall back to the system locale.
  - moment is not bundled; Obsidian provides it.
  - `obsidian`, `obsidian-daily-notes-interface` and `@types/moment` are flagged only because they depend on moment.
- **Dev tooling only** (not in the release): `@typescript-eslint/*` and `minimatch` (ReDoS, high), `eslint` and its config
  packages, `jest` / `ts-jest` / `babel-*` and `ejs` / `jake`, `svelte-check` / `svelte-preprocess` / `glob` / `rimraf` /
  `sorcery`, and `@rollup/plugin-commonjs` / `@rollup/plugin-node-resolve` / `deepmerge`. Most fixes need breaking major
  upgrades of the toolchain; they are planned but not done yet.
- **Technical debt:** `src/ui/stores.ts` and the calendar sources in `src/ui/sources/` (`tags`, `dots`) still use
  the global `window.app` instead of the plugin's `app` instance. This works in Obsidian but should be passed in explicitly.

## Development

```bash
npm install --legacy-peer-deps
npm run build   # lint (svelte-check, eslint) + rollup -> main.js
npm test        # jest unit tests (src/core/__tests__)
npm run dist    # build + test + dist/ (zip and the three plugin files)
```

Layout:

- `src/core`: pure functions without Obsidian (template choice, placeholders, dates, rules, paths, settings
  migration and validation, stats, i18n), covered by tests in `src/core/__tests__`;
- `src/io`: vault access (finding, creating and reading notes);
- `src/ui`: calendar view, menus, settings tab and dialogs (`src/ui/modals`);
- `src/main.ts`: plugin lifecycle and commands.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CHANGELOG.md](CHANGELOG.md).

## Contributing

Issues and pull requests are welcome. Please:

- keep `src/core` free of Obsidian imports and add or adjust tests there for logic changes;
- run `npm run build` and `npm test` before submitting (formatting: `npx prettier --write "src/**/*.ts"`);
- add user-visible strings to both languages in `src/core/i18n.ts`;
- describe user-visible changes in `CHANGELOG.md`.

## License

MIT. See [LICENSE](LICENSE). Original Calendar plugin © 2021 Liam Cain; this fork keeps the same license.

## Support

If this plugin is useful to you, you can support its development:

[![Donate to NomberProjects](https://img.shields.io/badge/Donate%20to-NomberProjects-6C5CE7?style=for-the-badge)](https://donatre.github.io/)

More plugins by NomberProjects: [nomberobsidian.github.io](https://nomberobsidian.github.io/)

<!-- A styled HTML version of this button (for sites that keep inline styles) is in docs/donate-button.html. -->
