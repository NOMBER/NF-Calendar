import moment from "moment";

import {
  chooseTemplate,
  defaultCondition,
  EMPTY_WEEKDAY_TEMPLATES,
  getTemplateCandidates,
  isConditionValid,
  matchesCondition,
  orderedWeekdays,
} from "../rules";
import type { ITemplateRule, RuleCondition } from "../rules";

const d = (s: string) => moment(s, "YYYY-MM-DD");
const all = () => true;

function rule(id: string, condition: RuleCondition, template: string, extra: Partial<ITemplateRule> = {}): ITemplateRule {
  return { id, name: id, enabled: true, condition, template, ...extra };
}

beforeAll(() => moment.locale("en"));

describe("matchesCondition", () => {
  it("specific date", () => {
    const c: RuleCondition = { type: "date", date: "2026-12-31" };
    expect(matchesCondition(d("2026-12-31"), c)).toBe(true);
    expect(matchesCondition(d("2025-12-31"), c)).toBe(false);
  });

  it("annual MM-DD, incl. Feb 29", () => {
    const c: RuleCondition = { type: "annual", monthDay: "03-08" };
    expect(matchesCondition(d("2026-03-08"), c)).toBe(true);
    expect(matchesCondition(d("2031-03-08"), c)).toBe(true);
    expect(matchesCondition(d("2026-03-09"), c)).toBe(false);
    expect(matchesCondition(d("2028-02-29"), { type: "annual", monthDay: "02-29" })).toBe(true);
  });

  it("range is inclusive and tolerates swapped bounds", () => {
    const c: RuleCondition = { type: "range", from: "2026-07-01", to: "2026-07-14" };
    expect(matchesCondition(d("2026-07-01"), c)).toBe(true);
    expect(matchesCondition(d("2026-07-14"), c)).toBe(true);
    expect(matchesCondition(d("2026-06-30"), c)).toBe(false);
    expect(matchesCondition(d("2026-07-15"), c)).toBe(false);
    expect(matchesCondition(d("2026-07-05"), { type: "range", from: "2026-07-14", to: "2026-07-01" })).toBe(true);
  });

  it("n-th weekday of month", () => {
    // October 2026: Thursdays 1, 8, 15, 22, 29; Fridays 2..30
    const firstThu: RuleCondition = { type: "nthWeekday", nth: 1, weekday: 4 };
    expect(matchesCondition(d("2026-10-01"), firstThu)).toBe(true);
    expect(matchesCondition(d("2026-10-08"), firstThu)).toBe(false);
    const fifthThu: RuleCondition = { type: "nthWeekday", nth: 5, weekday: 4 };
    expect(matchesCondition(d("2026-10-29"), fifthThu)).toBe(true);
    expect(matchesCondition(d("2026-10-22"), fifthThu)).toBe(false);
  });

  it("last Friday of month", () => {
    const lastFri: RuleCondition = { type: "nthWeekday", nth: -1, weekday: 5 };
    expect(matchesCondition(d("2026-10-30"), lastFri)).toBe(true);
    expect(matchesCondition(d("2026-10-23"), lastFri)).toBe(false);
    expect(matchesCondition(d("2026-02-27"), lastFri)).toBe(true); // Feb 2026 ends on Saturday 28
    expect(matchesCondition(d("2026-10-31"), lastFri)).toBe(false); // Saturday
  });

  it("even / odd ISO week", () => {
    // 2026-10-30 is ISO week 44; 2027-01-01 belongs to ISO week 53 of 2026
    expect(matchesCondition(d("2026-10-30"), { type: "weekParity", parity: "even" })).toBe(true);
    expect(matchesCondition(d("2026-10-30"), { type: "weekParity", parity: "odd" })).toBe(false);
    expect(matchesCondition(d("2027-01-01"), { type: "weekParity", parity: "odd" })).toBe(true);
  });

  it("invalid conditions never match", () => {
    expect(isConditionValid({ type: "date", date: "" })).toBe(false);
    expect(isConditionValid({ type: "annual", monthDay: "13-01" })).toBe(false);
    expect(matchesCondition(d("2026-10-30"), { type: "date", date: "" })).toBe(false);
    expect(isConditionValid(defaultCondition("nthWeekday"))).toBe(true);
    expect(isConditionValid(defaultCondition("weekParity"))).toBe(true);
  });
});

describe("template priority", () => {
  const base = {
    useWeekdayTemplates: true,
    weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES, friday: "T/Friday.md" },
    defaultTemplate: "T/Daily.md",
  };

  it("rule > weekday > default", () => {
    const settings = {
      ...base,
      templateRules: [rule("bday", { type: "annual", monthDay: "10-30" }, "T/Birthday.md")],
    };
    expect(chooseTemplate(d("2026-10-30"), settings, "day", all).chosen).toMatchObject({
      path: "T/Birthday.md",
      source: "rule",
      ruleName: "bday",
    });
    expect(chooseTemplate(d("2026-10-23"), settings, "day", all).chosen).toMatchObject({
      path: "T/Friday.md",
      source: "weekday",
      weekday: "friday",
    });
    expect(chooseTemplate(d("2026-10-22"), settings, "day", all).chosen).toMatchObject({
      path: "T/Daily.md",
      source: "default",
    });
  });

  it("first matching rule in list order wins; disabled rules are skipped", () => {
    const settings = {
      ...base,
      templateRules: [
        rule("off", { type: "date", date: "2026-10-30" }, "T/Off.md", { enabled: false }),
        rule("last", { type: "nthWeekday", nth: -1, weekday: 5 }, "T/LastFriday.md"),
        rule("bday", { type: "annual", monthDay: "10-30" }, "T/Birthday.md"),
      ],
    };
    const cands = getTemplateCandidates(d("2026-10-30"), settings, "day");
    expect(cands.map((c) => c.path)).toEqual([
      "T/LastFriday.md",
      "T/Birthday.md",
      "T/Friday.md",
      "T/Daily.md",
    ]);
  });

  it("falls back to the next candidate when a file is missing", () => {
    const settings = {
      ...base,
      templateRules: [rule("bday", { type: "annual", monthDay: "10-30" }, "T/Gone.md")],
    };
    const res = chooseTemplate(d("2026-10-30"), settings, "day", (p) => p !== "T/Gone.md");
    expect(res.chosen?.path).toBe("T/Friday.md");
    expect(res.missing.map((m) => m.path)).toEqual(["T/Gone.md"]);
    const none = chooseTemplate(d("2026-10-30"), settings, "day", () => false);
    expect(none.chosen).toBeNull();
    expect(none.missing).toHaveLength(3);
  });

  it("weekday templates only when enabled and not empty", () => {
    const off = { ...base, useWeekdayTemplates: false };
    expect(chooseTemplate(d("2026-10-30"), off, "day", all).chosen?.source).toBe("default");
    expect(chooseTemplate(d("2026-10-26"), base, "day", all).chosen?.source).toBe("default");
  });

  it("rules without a template file are ignored", () => {
    const settings = { ...base, templateRules: [rule("x", { type: "date", date: "2026-10-30" }, "  ")] };
    expect(chooseTemplate(d("2026-10-30"), settings, "day", all).chosen?.source).toBe("weekday");
  });

  it("weekly / monthly: rules by appliesTo, no weekday templates, default of the type", () => {
    const settings = {
      ...base,
      defaultTemplate: "T/Week.md",
      templateRules: [
        rule("daily-only", { type: "annual", monthDay: "10-26" }, "T/D.md"),
        rule("vacation", { type: "range", from: "2026-10-26", to: "2026-11-01" }, "T/VacationWeek.md", {
          appliesTo: ["week"],
        }),
      ],
    };
    // first day of the period is passed in by the caller
    expect(chooseTemplate(d("2026-10-26"), settings, "week", all).chosen?.path).toBe("T/VacationWeek.md");
    expect(chooseTemplate(d("2026-11-02"), settings, "week", all).chosen?.path).toBe("T/Week.md");
    expect(chooseTemplate(d("2026-10-26"), settings, "month", all).chosen?.path).toBe("T/Week.md");
    expect(chooseTemplate(d("2026-10-26"), settings, "day", all).chosen?.path).toBe("T/D.md");
  });

  it("orderedWeekdays starts at the first day of week", () => {
    expect(orderedWeekdays(1)[0]).toBe("monday");
    expect(orderedWeekdays(1)[6]).toBe("sunday");
    expect(orderedWeekdays(0)[0]).toBe("sunday");
  });
});
