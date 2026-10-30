/**
 * Integration-style test of the note creation flow with an in-memory vault.
 * The Obsidian API is mocked, so this checks our logic, not Obsidian itself.
 */
import moment from "moment";

jest.mock("obsidian", () => {
  class TAbstractFile {
    path: string;
    constructor(path: string) {
      this.path = path;
    }
  }
  class TFile extends TAbstractFile {}
  class TFolder extends TAbstractFile {}
  const notices: string[] = [];
  class Notice {
    constructor(msg: string) {
      notices.push(msg);
    }
  }
  return {
    TAbstractFile,
    TFile,
    TFolder,
    Notice,
    __notices: notices,
    normalizePath: (p: string) =>
      p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, ""),
    Modal: class {},
  };
});

const dailySettings = { format: "YYYY-MM-DD", folder: "Daily", template: "" };
jest.mock("obsidian-daily-notes-interface", () => ({
  getDailyNoteSettings: () => dailySettings,
  getAllDailyNotes: () => ({}),
  getDailyNote: (): null => null,
}));
jest.mock("src/ui/modal", () => ({ createConfirmationDialog: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const obsidian = require("obsidian");
import { createDailyNoteWithWeekdayTemplate } from "../dailyNotes";
import { getDefaultSettings } from "src/testUtils/settings";

function makeApp(files: Record<string, string>) {
  const store = new Map<string, unknown>();
  const contents = new Map<string, string>();
  for (const [path, text] of Object.entries(files)) {
    store.set(path, new obsidian.TFile(path));
    contents.set(path, text);
  }
  return {
    contents,
    vault: {
      getAbstractFileByPath: (p: string) => store.get(p) ?? null,
      createFolder: jest.fn(async (p: string) => {
        store.set(p, new obsidian.TFolder(p));
      }),
      create: jest.fn(async (p: string, data: string) => {
        const f = new obsidian.TFile(p);
        store.set(p, f);
        contents.set(p, data);
        return f;
      }),
      read: async (f: { path: string }) => contents.get(f.path) ?? "",
    },
    metadataCache: {
      getFirstLinkpathDest: (p: string) => store.get(`${p}.md`) ?? null,
    },
  };
}

describe("createDailyNoteWithWeekdayTemplate", () => {
  beforeAll(() => {
    moment.locale("en");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = { moment };
  });

  it("creates the note in the daily folder from the weekday template of the clicked date", async () => {
    dailySettings.template = "Templates/Default";
    const app = makeApp({
      "Templates/Monday.md": "# Monday {{title}} <% tp.file.title %>",
      "Templates/Default.md": "# Default {{title}}",
    });
    const settings = getDefaultSettings({
      useWeekdayTemplates: true,
      weekdayTemplates: {
        ...getDefaultSettings().weekdayTemplates,
        monday: "Templates/Monday",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const file = await createDailyNoteWithWeekdayTemplate(app as any, moment("2026-11-02"), settings);
    expect(file.path).toBe("Daily/2026-11-02.md");
    expect(app.vault.createFolder).toHaveBeenCalledWith("Daily");
    expect(app.contents.get("Daily/2026-11-02.md")).toBe(
      "# Monday 2026-11-02 <% tp.file.title %>"
    );

    // Tuesday has no weekday template -> fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createDailyNoteWithWeekdayTemplate(app as any, moment("2026-11-03"), settings);
    expect(app.contents.get("Daily/2026-11-03.md")).toBe("# Default 2026-11-03");
  });

  it("falls back with a Notice when the weekday template file is missing", async () => {
    dailySettings.template = "Templates/Default.md";
    const app = makeApp({ "Templates/Default.md": "default {{date}}" });
    const settings = getDefaultSettings({
      useWeekdayTemplates: true,
      weekdayTemplates: {
        ...getDefaultSettings().weekdayTemplates,
        friday: "Templates/Nope",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await createDailyNoteWithWeekdayTemplate(app as any, moment("2026-11-06"), settings);
    expect(app.contents.get("Daily/2026-11-06.md")).toBe("default 2026-11-06");
    expect(obsidian.__notices.join("\n")).toMatch(/Templates\/Nope/);
  });

  it("creates nested folders for formats like YYYY/MM/DD and does not overwrite existing notes", async () => {
    dailySettings.template = "";
    dailySettings.format = "YYYY/MM/YYYY-MM-DD";
    const app = makeApp({});
    const settings = getDefaultSettings();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f1 = await createDailyNoteWithWeekdayTemplate(app as any, moment("2026-11-02"), settings);
    expect(f1.path).toBe("Daily/2026/11/2026-11-02.md");
    expect(app.vault.createFolder.mock.calls.map((c) => c[0])).toEqual([
      "Daily",
      "Daily/2026",
      "Daily/2026/11",
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f2 = await createDailyNoteWithWeekdayTemplate(app as any, moment("2026-11-02"), settings);
    expect(f2).toBe(f1);
    expect(app.vault.create).toHaveBeenCalledTimes(1);
    dailySettings.format = "YYYY-MM-DD";
  });
});
