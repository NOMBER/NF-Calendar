import moment from "moment";

import {
  buildHolidayIndex,
  holidayAge,
  compileHolidayPattern,
  holidaysOn,
  isValidHolidayPattern,
  parseHolidayName,
  upcomingHolidays,
} from "../holidays";

const dayFirst = { order: "dayFirst" as const };
const monthFirst = { order: "monthFirst" as const };

describe("parseHolidayName", () => {
  test.each([
    ["08.03 Women's day", "03-08", "Women's day"],
    ["08-03 Women's day", "03-08", "Women's day"],
    ["08/03 - Women's day", "03-08", "Women's day"],
    ["8.3 Short", "03-08", "Short"],
    ["29.02 Leap", "02-29", "Leap"],
  ])("day first: %s", (name, md, title) => {
    expect(parseHolidayName(name, dayFirst)).toEqual({ monthDay: md, name: title });
  });

  test("YYYY-MM-DD with or without ' - ' separator; year kept", () => {
    expect(parseHolidayName("1999-03-13 - День Рождения Натальи", dayFirst)).toEqual({
      monthDay: "03-13",
      name: "День Рождения Натальи",
      year: 1999,
    });
    expect(parseHolidayName("1000-09-01 День знаний", dayFirst)).toEqual({
      monthDay: "09-01",
      name: "День знаний",
      year: 1000,
    });
    expect(parseHolidayName("1990.12.31 — New Year's Eve", dayFirst)?.name).toBe("New Year's Eve");
    expect(parseHolidayName("2024-05-09Victory", dayFirst)?.name).toBe("Victory");
  });

  test("age only for real years (>= 1900)", () => {
    const at = moment("2026-03-13");
    expect(holidayAge(parseHolidayName("1999-03-13 - День Рождения Натальи", dayFirst)!, at)).toBe(
      27,
    );
    expect(holidayAge(parseHolidayName("1000-09-01 День знаний", dayFirst)!, at)).toBeNull();
    expect(holidayAge(parseHolidayName("1899-01-01 X", dayFirst)!, at)).toBeNull();
    expect(holidayAge(parseHolidayName("13.03 Без года", dayFirst)!, at)).toBeNull();
  });

  test("month first reads MM-DD; ISO dates are unaffected", () => {
    expect(parseHolidayName("12-25 Christmas", monthFirst)).toEqual({
      monthDay: "12-25",
      name: "Christmas",
    });
    expect(parseHolidayName("12-25 Christmas", dayFirst)).toBeNull(); // month 25
    expect(parseHolidayName("2024-05-09 X", monthFirst)?.monthDay).toBe("05-09");
  });

  test("rejects non-dates and impossible days", () => {
    expect(parseHolidayName("Holiday list", dayFirst)).toBeNull();
    expect(parseHolidayName("31.04 Nope", dayFirst)).toBeNull();
    expect(parseHolidayName("123.04 Nope", dayFirst)).toBeNull();
    expect(parseHolidayName("2024-13-01 X", dayFirst)).toBeNull();
  });

  test("name falls back to the date", () => {
    expect(parseHolidayName("01.01", dayFirst)).toEqual({ monthDay: "01-01", name: "01-01" });
  });

  test("custom pattern is matched literally and safely", () => {
    expect(parseHolidayName("[25]12 Xmas", { ...dayFirst, pattern: "[DD]MM" })).toEqual({
      monthDay: "12-25",
      name: "Xmas",
    });
    expect(parseHolidayName("2024_03_08 X", { ...dayFirst, pattern: "YYYY_MM_DD" })?.monthDay).toBe(
      "03-08",
    );
    expect(compileHolidayPattern("(.*)+DD")).toBeNull(); // no month
    expect(compileHolidayPattern("(.*)+DD.MM")?.regex.test("(.*)+01.02")).toBe(true);
    expect(compileHolidayPattern("(.*)+DD.MM")?.regex.test("aaaa01.02")).toBe(false);
    expect(isValidHolidayPattern("DD.MM.DD")).toBe(false); // repeated token
    expect(isValidHolidayPattern("x".repeat(30) + "DDMM")).toBe(false);
    expect(isValidHolidayPattern("")).toBe(true);
  });
});

describe("index", () => {
  const files = [
    { path: "Meta/Dates/08.03 Women's day.md", basename: "08.03 Women's day" },
    { path: "Meta/Dates/2020-03-08 Another.md", basename: "2020-03-08 Another" },
    { path: "Meta/Dates/31.12 NYE.md", basename: "31.12 NYE" },
    { path: "Meta/Dates/readme.md", basename: "readme" },
  ];
  const { index, unrecognized } = buildHolidayIndex(files, dayFirst);

  test("groups by MM-DD, yearly, sorted by name", () => {
    expect(holidaysOn(index, moment("2031-03-08"))[0].year).toBe(2020);
    expect(holidaysOn(index, moment("2031-03-08")).map((h) => h.name)).toEqual([
      "Another",
      "Women's day",
    ]);
    expect(holidaysOn(index, moment("2031-03-09"))).toEqual([]);
    expect(unrecognized).toEqual(["Meta/Dates/readme.md"]);
  });

  test("upcoming within horizon, across the year end", () => {
    const up = upcomingHolidays(index, moment("2026-12-30"), 70);
    expect(up.map((u) => [u.date.format("YYYY-MM-DD"), u.daysLeft])).toEqual([
      ["2026-12-31", 1],
      ["2027-03-08", 68],
    ]);
  });
});
