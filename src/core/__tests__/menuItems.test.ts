import {
  MENU_ITEM_IDS,
  defaultMenuItems,
  moveMenuItem,
  resolveMenuLayout,
  sanitizeMenuItems,
  setMenuItemVisible,
} from "../menuItems";
import { SETTINGS_VERSION, migrateSettings } from "../settings";

const ids = (l: { id: string }[]) => l.map((p) => p.id);

describe("menu items", () => {
  it("default: all items, visible, default order", () => {
    expect(ids(defaultMenuItems())).toEqual([...MENU_ITEM_IDS]);
    expect(defaultMenuItems().every((p) => p.visible)).toBe(true);
    expect(ids(sanitizeMenuItems(undefined))).toEqual([...MENU_ITEM_IDS]);
    expect(ids(sanitizeMenuItems("x"))).toEqual([...MENU_ITEM_IDS]);
  });

  it("drops unknown/duplicate ids, keeps order and visibility, adds missing", () => {
    const s = sanitizeMenuItems([
      { id: "settings", visible: true },
      { id: "nope", visible: true },
      { id: "statistics", visible: false },
      { id: "settings", visible: false },
      42,
      "openToday",
    ]);
    expect(s.filter((p) => p.id !== "openYesterday").slice(0, 3)).toEqual([
      { id: "settings", visible: true },
      { id: "statistics", visible: false },
      { id: "openToday", visible: true },
    ]);
    expect(s).toHaveLength(MENU_ITEM_IDS.length);
    expect(new Set(ids(s)).size).toBe(MENU_ITEM_IDS.length);
  });

  it("a new (future) item lands after its default predecessor, visible", () => {
    const stored = defaultMenuItems()
      .filter((p) => p.id !== "toggleImportant")
      .reverse();
    const s = sanitizeMenuItems(stored);
    const i = ids(s).indexOf("toggleImportant");
    expect(s[i - 1].id).toBe("toggleHolidays");
    expect(s[i].visible).toBe(true);
    // missing first item goes to the top
    const s2 = sanitizeMenuItems(defaultMenuItems().slice(1));
    expect(s2[0].id).toBe("openYesterday");
  });

  it("move up/down and edges", () => {
    const d = defaultMenuItems();
    expect(ids(moveMenuItem(d, "openToday", -1)).slice(0, 2)).toEqual([
      "openToday",
      "openYesterday",
    ]);
    expect(ids(moveMenuItem(d, "openToday", 1)).slice(1, 3)).toEqual(["openTomorrow", "openToday"]);
    expect(moveMenuItem(d, "openYesterday", -1)).toEqual(d);
    expect(moveMenuItem(d, "settings", 1)).toEqual(d);
    expect(ids(d)).toEqual([...MENU_ITEM_IDS]); // not mutated
  });

  it("layout: hidden and unavailable items skipped, separators between groups only", () => {
    let l = defaultMenuItems().map((p) => ({ ...p, visible: false }));
    l = setMenuItemVisible(l, "openToday", true);
    l = setMenuItemVisible(l, "statistics", true);
    l = setMenuItemVisible(l, "importantList", true);
    l = setMenuItemVisible(l, "prevDaily", true);
    expect(resolveMenuLayout(l, (id) => id !== "prevDaily").entries).toEqual([
      "openToday",
      "separator",
      "importantList",
      "statistics",
    ]);
  });

  it("never empty: falls back to plugin settings", () => {
    const none = defaultMenuItems().map((p) => ({ ...p, visible: false }));
    expect(resolveMenuLayout(none)).toEqual({ entries: ["settings"], fallback: true });
    const onlyPrev = setMenuItemVisible(none, "prevDaily", true);
    expect(resolveMenuLayout(onlyPrev, (id) => id !== "prevDaily").entries).toEqual(["settings"]);
    const onlySettings = setMenuItemVisible(none, "settings", true);
    expect(resolveMenuLayout(onlySettings)).toEqual({ entries: ["settings"], fallback: false });
  });

  it("settings v6 -> v7 migration adds the default menu; stored menu sanitized", () => {
    expect(SETTINGS_VERSION).toBe(9);
    const m = migrateSettings({ settingsVersion: 6, showHolidayMarks: false });
    expect(m.migratedFrom).toBe(6);
    expect(m.settings.menuItems).toEqual(defaultMenuItems());
    expect(m.settings.showHolidayMarks).toBe(false);
    const k = migrateSettings({
      settingsVersion: 7,
      menuItems: [{ id: "settings", visible: true }, { id: "bogus" }],
    });
    expect(k.migratedFrom).toBe(7);
    expect(k.settings.menuItems.find((p) => p.id === "settings")).toEqual({
      id: "settings",
      visible: true,
    });
    expect(k.settings.menuItems).toHaveLength(MENU_ITEM_IDS.length);
  });
});
