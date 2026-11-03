# Calendar (Weekday Templates)

**English** · [Русский](README.ru.md)

A calendar view for [Obsidian](https://obsidian.md) with built-in daily, weekly and monthly notes and
rule-based templates: per weekday, per date, per date range, "last Friday of the month", even/odd weeks and more.

This is a fork of [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) by **Liam Cain**, released under
the MIT license (see [LICENSE](LICENSE)). All credit for the original calendar view goes to him; the original README is
kept in [README.original.md](README.original.md).

- Plugin id: `calendar-weekday-templates`, version 2.1.1
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
  condition, the note types it applies to (daily / weekly / monthly) and a template file. Conditions:
  - a specific date `YYYY-MM-DD`;
  - every year on `MM-DD` (birthdays, holidays);
  - a date range (vacation);
  - the N-th weekday of the month (1st–5th or **last**, e.g. "last Friday");
  - even or odd ISO week.
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
  &lt;month&gt;".
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
  - Right-click a day → "Mark as important…": set a name, a color from a theme-aware palette and "prepare N days before" (0–30).
  - The day gets a colored outline and the preparation days are softly highlighted.
  - A collapsible **Upcoming important days** list under the calendar opens the note on click.
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

1. Take `dist/calendar-weekday-templates.zip` (or `main.js`, `manifest.json` and `styles.css` from `dist/`).
2. Unzip it into `<your vault>/.obsidian/plugins/`. You should get a folder `calendar-weekday-templates/` with the three files.
3. Restart Obsidian, or click "Reload plugins" under Community plugins, then enable **Calendar (Weekday Templates)**.
4. It is best to disable the original Calendar. Once this plugin is set up, Daily Notes and Periodic Notes can be disabled too.

### Upgrading from 1.x

2.0 changed the settings format (`settingsVersion: 2`). On the first start after the upgrade the plugin **once** imports
the folder, format and template from the core Daily Notes and Periodic Notes plugins (if they were configured), plus the 1.x
weekday templates. It then saves the new settings and shows a notice. After that it no longer reads other plugins' settings. On a fresh
install the import only runs when you click **Import from Daily Notes / Periodic Notes**.

## Configuration

- **General:**
  - Language;
  - words per dot;
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

Rules are checked top to bottom, so place more specific rules (a single date) above broader ones (a range).

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
- **`data.json` validation.** On load, types, allowed values and limits are checked: week start, locale id, words per dot,
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
- **Technical debt:** `src/ui/stores.ts` and the calendar sources in `src/ui/sources/` (`tags`, `tasks`, `wordCount`) still use
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

[![Donate to NomberProjects](https://img.shields.io/badge/Donate%20to-NomberProjects-6C5CE7?style=for-the-badge)](https://donatr.ee/nomber)

<!-- A styled HTML version of this button (for sites that keep inline styles) is in docs/donate-button.html. -->
