import moment from "moment";

import {
  RULE_CONDITION_GROUPS,
  RULE_CONDITION_TYPES,
  defaultCondition,
  getTemplateCandidates,
  isConditionValid,
  isValidMonthDay,
  matchesCondition,
  sanitizeCondition,
  weekOfMonth,
} from "../rules";
import type { RuleCondition } from "../rules";

const d = (s: string) => moment(s, "YYYY-MM-DD");
const m = (s: string, c: RuleCondition, ctx = {}) => matchesCondition(d(s), c, ctx);

beforeAll(() => moment.locale("en")); // weeks start on Sunday

describe("2.2.0 rule types", () => {
  test("annual: day + month every year, invalid days rejected", () => {
    const c: RuleCondition = { type: "annual", monthDay: "05-09" };
    expect(m("2026-05-09", c)).toBe(true);
    expect(m("1999-05-09", c)).toBe(true);
    expect(m("2026-05-10", c)).toBe(false);
    expect(isValidMonthDay("02-29")).toBe(true);
    expect(isValidMonthDay("02-30")).toBe(false);
    expect(isValidMonthDay("04-31")).toBe(false);
  });

  test("monthDays: plain and wrapping ranges", () => {
    const c: RuleCondition = { type: "monthDays", from: 10, to: 15 };
    expect(m("2026-03-10", c)).toBe(true);
    expect(m("2026-03-15", c)).toBe(true);
    expect(m("2026-03-16", c)).toBe(false);
    const wrap: RuleCondition = { type: "monthDays", from: 28, to: 3 };
    expect(m("2026-03-30", wrap)).toBe(true);
    expect(m("2026-04-02", wrap)).toBe(true);
    expect(m("2026-04-10", wrap)).toBe(false);
    expect(isConditionValid({ type: "monthDays", from: 0, to: 3 })).toBe(false);
  });

  test("lastDays: last N days, month length aware", () => {
    const c: RuleCondition = { type: "lastDays", count: 3 };
    expect(m("2026-02-26", c)).toBe(true);
    expect(m("2026-02-28", c)).toBe(true);
    expect(m("2026-02-25", c)).toBe(false);
    expect(m("2026-03-29", c)).toBe(true);
    expect(m("2026-03-28", c)).toBe(false);
  });

  test("monthEdge", () => {
    expect(m("2026-06-01", { type: "monthEdge", edge: "first" })).toBe(true);
    expect(m("2026-06-02", { type: "monthEdge", edge: "first" })).toBe(false);
    expect(m("2028-02-29", { type: "monthEdge", edge: "last" })).toBe(true);
    expect(m("2026-02-28", { type: "monthEdge", edge: "last" })).toBe(true);
    expect(m("2026-06-29", { type: "monthEdge", edge: "last" })).toBe(false);
  });

  test("quarterEdge", () => {
    const start: RuleCondition = { type: "quarterEdge", edge: "start" };
    const end: RuleCondition = { type: "quarterEdge", edge: "end" };
    expect(m("2026-04-01", start)).toBe(true);
    expect(m("2026-05-01", start)).toBe(false);
    expect(m("2026-06-30", end)).toBe(true);
    expect(m("2026-12-31", end)).toBe(true);
    expect(m("2026-11-30", end)).toBe(false);
  });

  test("weekdays: several days in one rule", () => {
    const weekend: RuleCondition = { type: "weekdays", days: [0, 6] };
    expect(m("2026-11-07", weekend)).toBe(true); // Saturday
    expect(m("2026-11-08", weekend)).toBe(true); // Sunday
    expect(m("2026-11-09", weekend)).toBe(false);
    expect(isConditionValid({ type: "weekdays", days: [] })).toBe(false);
    expect(sanitizeCondition({ type: "weekdays", days: [5, 1, 1, 9, "x"] })).toEqual({
      type: "weekdays",
      days: [1, 5],
    });
  });

  test("weekOfMonth (locale weeks) and last week", () => {
    // Nov 2026 starts on Sunday: weeks 1..5, Nov 29-30 = week 5
    expect(weekOfMonth(d("2026-11-01"))).toBe(1);
    expect(weekOfMonth(d("2026-11-08"))).toBe(2);
    expect(m("2026-11-03", { type: "weekOfMonth", week: 1 })).toBe(true);
    expect(m("2026-11-30", { type: "weekOfMonth", week: -1 })).toBe(true);
    expect(m("2026-11-28", { type: "weekOfMonth", week: -1 })).toBe(false);
    expect(isConditionValid({ type: "weekOfMonth", week: 7 })).toBe(false);
  });

  test("everyNDays from a start date", () => {
    const c: RuleCondition = { type: "everyNDays", start: "2026-10-30", every: 3 };
    expect(m("2026-10-30", c)).toBe(true);
    expect(m("2026-11-02", c)).toBe(true);
    expect(m("2026-11-01", c)).toBe(false);
    expect(m("2026-10-27", c)).toBe(false); // before start
    expect(m("2027-03-30", { type: "everyNDays", start: "2027-03-01", every: 1 })).toBe(true);
    expect(isConditionValid({ type: "everyNDays", start: "2026-10-30", every: 0 })).toBe(false);
  });

  test("holiday and important use the context", () => {
    const ctx = {
      isHoliday: (x: moment.Moment) => x.format("MM-DD") === "01-01",
      isImportant: (x: moment.Moment) => x.date() === 5,
    };
    expect(m("2027-01-01", { type: "holiday" }, ctx)).toBe(true);
    expect(m("2027-01-02", { type: "holiday" }, ctx)).toBe(false);
    expect(m("2027-01-05", { type: "important" }, ctx)).toBe(true);
    expect(m("2027-01-05", { type: "important" })).toBe(false); // no context
  });

  test("every type has a valid-or-fillable default, sanitizes and is grouped", () => {
    const grouped = RULE_CONDITION_GROUPS.flatMap((g) => g.types).sort();
    expect(grouped).toEqual([...RULE_CONDITION_TYPES].sort());
    for (const type of RULE_CONDITION_TYPES) {
      const c = defaultCondition(type);
      expect(sanitizeCondition(c)).toEqual(c);
    }
    expect(RULE_CONDITION_TYPES[0]).toBe("annual");
    expect(RULE_CONDITION_TYPES[RULE_CONDITION_TYPES.length - 1]).toBe("date");
  });

  test("context reaches getTemplateCandidates; old one-off date rules still work", () => {
    const rules = [
      {
        id: "h",
        name: "H",
        enabled: true,
        condition: { type: "holiday" } as RuleCondition,
        template: "H.md",
      },
      {
        id: "o",
        name: "O",
        enabled: true,
        condition: { type: "date", date: "2026-01-01" } as RuleCondition,
        template: "O.md",
      },
    ];
    const c = getTemplateCandidates(d("2026-01-01"), { templateRules: rules }, "day", {
      isHoliday: () => true,
    });
    expect(c.map((x) => x.path)).toEqual(["H.md", "O.md"]);
  });
});
