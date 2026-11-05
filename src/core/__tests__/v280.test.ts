import moment from "moment";

import {
  DATE_FIELD_FORMATS,
  dateFieldPlaceholder,
  formatDateField,
  parseDateField,
  sanitizeDateFieldFormat,
} from "src/core/dateField";
import { contextDate, datesUntilEndOf } from "src/core/dates";
import { migrateSettings, SETTINGS_VERSION } from "src/core/settings";
import { startupInsertIndex } from "src/core/tabs";

describe("date field format", () => {
  const expected: Record<string, string> = {
    "DD.MM.YYYY": "05.03.2027",
    "DD-MM-YYYY": "05-03-2027",
    "DD/MM/YYYY": "05/03/2027",
    "YYYY.MM.DD": "2027.03.05",
    "YYYY-MM-DD": "2027-03-05",
    "YYYY/MM/DD": "2027/03/05",
    "MM.DD.YYYY": "03.05.2027",
    "MM-DD-YYYY": "03-05-2027",
    "MM/DD/YYYY": "03/05/2027",
  };
  it.each(DATE_FIELD_FORMATS.map((f) => [f]))("%s: format/parse round trip", (f) => {
    expect(formatDateField("2027-03-05", f)).toBe(expected[f]);
    expect(parseDateField(expected[f], f)).toBe("2027-03-05");
    expect(parseDateField("2027-03-05", f)).toBe("2027-03-05"); // ISO always accepted
    expect(parseDateField("31.02.2027", f)).toBeNull();
    expect(parseDateField("", f)).toBeNull();
    expect(formatDateField("", f)).toBe("");
  });
  it("lenient separators and single digits, strict validity", () => {
    expect(parseDateField("5/3/2027", "DD.MM.YYYY")).toBe("2027-03-05");
    expect(parseDateField("3 5 2027", "MM/DD/YYYY")).toBe("2027-03-05");
    expect(parseDateField("29.02.2028", "DD.MM.YYYY")).toBe("2028-02-29");
    expect(parseDateField("29.02.2027", "DD.MM.YYYY")).toBeNull();
    expect(parseDateField("13.13.2027", "DD.MM.YYYY")).toBeNull();
    expect(parseDateField("05.03.27", "DD.MM.YYYY")).toBeNull();
    expect(parseDateField("a.b.c", "DD.MM.YYYY")).toBeNull();
  });
  it("placeholder and sanitize", () => {
    expect(dateFieldPlaceholder("YYYY.MM.DD", "ru")).toBe("ГГГГ.ММ.ДД");
    expect(dateFieldPlaceholder("DD/MM/YYYY", "en")).toBe("DD/MM/YYYY");
    expect(sanitizeDateFieldFormat("junk")).toBe("DD.MM.YYYY");
  });
});

describe("startup tab index", () => {
  it("after last pinned, else first", () => {
    expect(startupInsertIndex([])).toBe(0);
    expect(startupInsertIndex([false, false])).toBe(0);
    expect(startupInsertIndex([true, false, false])).toBe(1);
    expect(startupInsertIndex([true, false, true, false])).toBe(3);
  });
});

describe("missing notes range from the open note", () => {
  const today = moment("2027-03-03", "YYYY-MM-DD");
  it("open note wins, else selected, else today", () => {
    const open = moment("2027-03-17", "YYYY-MM-DD");
    expect(contextDate(open, null, today).format("YYYY-MM-DD")).toBe("2027-03-17");
    expect(contextDate(null, moment("2027-01-02"), today).format("YYYY-MM-DD")).toBe("2027-01-02");
    expect(contextDate(null, null, today).format("YYYY-MM-DD")).toBe("2027-03-03");
  });
  it("to the end of THAT week / month, past included", () => {
    moment.updateLocale("en", { week: { dow: 1, doy: 4 } });
    const w = datesUntilEndOf(moment("2027-03-17", "YYYY-MM-DD"), "week");
    expect(w.map((d) => d.format("YYYY-MM-DD"))).toEqual([
      "2027-03-17",
      "2027-03-18",
      "2027-03-19",
      "2027-03-20",
      "2027-03-21",
    ]);
    const m = datesUntilEndOf(moment("2026-02-27", "YYYY-MM-DD"), "month");
    expect(m.map((d) => d.format("DD"))).toEqual(["27", "28"]);
  });
});

describe("settings v9", () => {
  it("defaults for new fields; values kept", () => {
    expect(SETTINGS_VERSION).toBe(11);
    const a = migrateSettings({ settingsVersion: 8 });
    expect(a.migratedFrom).toBe(8);
    expect(a.settings.startupTabPosition).toBe("left");
    expect(a.settings.dateFieldFormat).toBe("DD.MM.YYYY");
    expect(a.settings.missingFromOpenNote).toBe(true);
    const b = migrateSettings({
      settingsVersion: 10,
      startupTabPosition: "right",
      dateFieldFormat: "YYYY/MM/DD",
      missingFromOpenNote: false,
    }).settings;
    expect([b.startupTabPosition, b.dateFieldFormat, b.missingFromOpenNote]).toEqual([
      "right",
      "YYYY/MM/DD",
      false,
    ]);
    expect(
      migrateSettings({ settingsVersion: 9, startupTabPosition: "x" }).settings.startupTabPosition,
    ).toBe("left");
  });
});
