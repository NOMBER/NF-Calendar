import moment from "moment";

import { applyTemplate, firstLines, usesCarryover } from "../placeholders";

beforeAll(() => moment.locale("en"));

describe("applyTemplate", () => {
  const date = moment("2026-10-30", "YYYY-MM-DD");
  const now = moment("2026-10-28 09:05", "YYYY-MM-DD HH:mm");

  it("replaces date/title/time relative to the note date", () => {
    expect(applyTemplate("# {{title}} {{date}} {{time}}", date, "YYYY-MM-DD", now)).toBe(
      "# 2026-10-30 2026-10-30 09:05",
    );
  });

  it("supports offsets and custom formats", () => {
    expect(
      applyTemplate("{{date+1d:DD.MM}} {{date-1w}} {{date:dddd}}", date, "YYYY-MM-DD", now),
    ).toBe("31.10 2026-10-23 Friday");
  });

  it("yesterday / tomorrow / weekday", () => {
    expect(applyTemplate("{{yesterday}} {{tomorrow}}", date, "YYYY-MM-DD", now)).toBe(
      "2026-10-29 2026-10-31",
    );
    expect(applyTemplate("{{monday:YYYY-MM-DD}}", date, "YYYY-MM-DD", now)).toBe("2026-10-26");
  });

  it("leaves Templater syntax untouched", () => {
    const tpl = '<% tp.date.now("YYYY") %> {{date}}';
    expect(applyTemplate(tpl, date, "YYYY-MM-DD", now)).toBe(
      '<% tp.date.now("YYYY") %> 2026-10-30',
    );
  });

  it("uses the note format for weekly notes", () => {
    expect(applyTemplate("{{title}}", moment("2026-10-26"), "gggg-[W]ww", now)).toMatch(
      /^2026-W\d\d$/,
    );
  });
});

describe("firstLines", () => {
  it("returns at most n lines and flags truncation", () => {
    expect(firstLines("a\nb\nc", 2)).toEqual({ lines: ["a", "b"], truncated: true });
    expect(firstLines("a\r\nb", 5)).toEqual({ lines: ["a", "b"], truncated: false });
  });
});

describe("{{carryover}}", () => {
  const date = moment("2026-10-30", "YYYY-MM-DD");

  it("is detected and replaced (empty when nothing to carry)", () => {
    expect(usesCarryover("## Tasks\n{{ carryover }}")).toBe(true);
    expect(usesCarryover("{{date}}")).toBe(false);
    expect(applyTemplate("A\n{{carryover}}\nB", date, "YYYY-MM-DD")).toBe("A\n\nB");
    expect(
      applyTemplate("{{carryover}}", date, "YYYY-MM-DD", date, { carryover: "- [ ] a\n- [ ] b" }),
    ).toBe("- [ ] a\n- [ ] b");
  });
});
