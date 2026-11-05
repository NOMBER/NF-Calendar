import * as fs from "fs";
import * as path from "path";

/**
 * Every user-facing ⋯ / modal action must have an addCommand id (no default hotkeys).
 * Ids stay stable so user keybindings survive upgrades.
 */
export const KEY_ACTION_COMMAND_IDS = [
  "show-statistics",
  "open-random-daily-note",
  "show-date-navigator",
  "create-missing-daily-notes-week",
  "create-missing-daily-notes-week-back",
  "create-missing-daily-notes-week-full",
  "create-missing-daily-notes-month",
  "create-missing-daily-notes-displayed-month",
  "toggle-holiday-marks",
  "toggle-important-marks",
  "open-plugin-settings",
  "organize-daily-notes-by-year",
  "organize-daily-notes-by-year-month",
  "organize-daily-notes-flat",
  "undo-last-organize",
  "show-important-days",
] as const;

describe("registered command ids (hotkey surface)", () => {
  const mainSrc = fs.readFileSync(path.join(__dirname, "../../main.ts"), "utf8");

  it("lists key action command ids", () => {
    expect([...KEY_ACTION_COMMAND_IDS]).toEqual([
      "show-statistics",
      "open-random-daily-note",
      "show-date-navigator",
      "create-missing-daily-notes-week",
      "create-missing-daily-notes-week-back",
      "create-missing-daily-notes-week-full",
      "create-missing-daily-notes-month",
      "create-missing-daily-notes-displayed-month",
      "toggle-holiday-marks",
      "toggle-important-marks",
      "open-plugin-settings",
      "organize-daily-notes-by-year",
      "organize-daily-notes-by-year-month",
      "organize-daily-notes-flat",
      "undo-last-organize",
      "show-important-days",
    ]);
  });

  it("registers each key action via cmd(...) in main.ts", () => {
    for (const id of KEY_ACTION_COMMAND_IDS) {
      expect(mainSrc).toContain(`"${id}"`);
    }
  });

  it("defers modal.open from Menu (stats / other modals)", () => {
    expect(mainSrc).toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?modal\.open\(\)/);
    expect(mainSrc).toContain('notice.modalFailed');
    expect(mainSrc).toContain('notice.statsFailed');
  });
});
