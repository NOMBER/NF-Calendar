/**
 * The calendar's ⋯ menu: which items are shown and in what order.
 * Stored as an ordered list of `{ id, visible }`. Pure logic, no Obsidian.
 */

export const MENU_ITEM_IDS = [
  "openYesterday",
  "openToday",
  "openTomorrow",
  "openWeekly",
  "openMonthly",
  "toggleHolidays",
  "toggleImportant",
  "missingWeek",
  "missingMonth",
  "missingDisplayedMonth",
  "prevDaily",
  "nextDaily",
  "applyTemplate",
  "importantList",
  "statistics",
  "settings",
] as const;

export type MenuItemId = (typeof MENU_ITEM_IDS)[number];

export interface IMenuItemPref {
  id: MenuItemId;
  visible: boolean;
}

/** Group of each item; a separator is drawn between neighbours of different groups. */
export const MENU_ITEM_GROUP: Record<MenuItemId, number> = {
  openYesterday: 0,
  openToday: 0,
  openTomorrow: 0,
  openWeekly: 0,
  openMonthly: 0,
  toggleHolidays: 1,
  toggleImportant: 1,
  missingWeek: 2,
  missingMonth: 2,
  missingDisplayedMonth: 2,
  prevDaily: 2,
  nextDaily: 2,
  applyTemplate: 2,
  importantList: 3,
  statistics: 3,
  settings: 3,
};

/** Always reachable when nothing else would be shown. */
export const MENU_FALLBACK_ITEM: MenuItemId = "settings";

export function defaultMenuItems(): IMenuItemPref[] {
  return MENU_ITEM_IDS.map((id) => ({ id, visible: true }));
}

const isId = (v: unknown): v is MenuItemId =>
  typeof v === "string" && (MENU_ITEM_IDS as readonly string[]).includes(v);

/**
 * Drops unknown and duplicate ids, keeps the user's order, and inserts
 * items unknown to the stored list (added in a later version) visible,
 * right after their default predecessor.
 */
export function sanitizeMenuItems(raw: unknown): IMenuItemPref[] {
  if (!Array.isArray(raw)) return defaultMenuItems();
  const out: IMenuItemPref[] = [];
  for (const e of raw) {
    const id = e && typeof e === "object" ? (e as { id?: unknown }).id : e;
    if (!isId(id) || out.some((p) => p.id === id)) continue;
    const vis = e && typeof e === "object" ? (e as { visible?: unknown }).visible : true;
    out.push({ id, visible: vis !== false });
  }
  MENU_ITEM_IDS.forEach((id, idx) => {
    if (out.some((p) => p.id === id)) return;
    let at = 0;
    for (let k = idx - 1; k >= 0; k--) {
      const prev = out.findIndex((p) => p.id === MENU_ITEM_IDS[k]);
      if (prev >= 0) {
        at = prev + 1;
        break;
      }
    }
    out.splice(at, 0, { id, visible: true });
  });
  return out;
}

/** Swaps an item with its neighbour; returns a new list (unchanged at the edges). */
export function moveMenuItem(list: IMenuItemPref[], id: MenuItemId, dir: -1 | 1): IMenuItemPref[] {
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list.slice();
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function setMenuItemVisible(
  list: IMenuItemPref[],
  id: MenuItemId,
  visible: boolean,
): IMenuItemPref[] {
  return list.map((p) => (p.id === id ? { ...p, visible } : p));
}

export type MenuEntry = MenuItemId | "separator";

/**
 * Final menu layout. `available(id)` tells whether an item makes sense now
 * (e.g. prev/next only with a daily note open). If nothing would be shown,
 * the fallback item ("Open plugin settings") is shown so the menu is never
 * empty and the settings stay one click away.
 */
export function resolveMenuLayout(
  list: IMenuItemPref[],
  available: (id: MenuItemId) => boolean = () => true,
): { entries: MenuEntry[]; fallback: boolean } {
  const ids = sanitizeMenuItems(list)
    .filter((p) => p.visible && available(p.id))
    .map((p) => p.id);
  if (!ids.length) return { entries: [MENU_FALLBACK_ITEM], fallback: true };
  const entries: MenuEntry[] = [];
  ids.forEach((id, k) => {
    if (k > 0 && MENU_ITEM_GROUP[id] !== MENU_ITEM_GROUP[ids[k - 1]]) entries.push("separator");
    entries.push(id);
  });
  return { entries, fallback: false };
}
