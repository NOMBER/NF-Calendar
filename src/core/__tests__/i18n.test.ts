import { DICTIONARIES, resolveLanguage, setLanguage, t } from "../../i18n";

describe("i18n", () => {
  it("Russian translation is complete", () => {
    const en = Object.keys(DICTIONARIES.en).sort();
    const ru = Object.keys(DICTIONARIES.ru).sort();
    expect(ru).toEqual(en);
    for (const k of ru) {
      expect(DICTIONARIES.ru[k as keyof typeof DICTIONARIES.ru].length).toBeGreaterThan(0);
    }
  });

  it("placeholders match between languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
    for (const k of Object.keys(DICTIONARIES.en) as Array<keyof typeof DICTIONARIES.en>) {
      expect([k, vars(DICTIONARIES.ru[k])]).toEqual([k, vars(DICTIONARIES.en[k])]);
    }
  });

  it("resolves language and substitutes vars", () => {
    expect(resolveLanguage("auto", "ru")).toBe("ru");
    expect(resolveLanguage("auto", "de")).toBe("en");
    expect(resolveLanguage("en", "ru")).toBe("en");
    setLanguage("ru");
    expect(t("upcoming.inDays", { days: 3 })).toBe("через 3 дн.");
    setLanguage("en");
    expect(t("upcoming.inDays", { days: 3 })).toBe("in 3 d");
  });
});
