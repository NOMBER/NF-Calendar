/**
 * Order and separator of typed date fields (Go to date, random range, rule
 * dates). Stored values stay ISO YYYY-MM-DD; only display/parsing changes.
 */

export type DateFieldOrder = "dmy" | "ymd" | "mdy";
export type DateFieldSep = "." | "-" | "/";

export const DATE_FIELD_FORMATS = [
  "DD.MM.YYYY",
  "DD-MM-YYYY",
  "DD/MM/YYYY",
  "YYYY.MM.DD",
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "MM.DD.YYYY",
  "MM-DD-YYYY",
  "MM/DD/YYYY",
] as const;
export type DateFieldFormat = (typeof DATE_FIELD_FORMATS)[number];
export const DEFAULT_DATE_FIELD_FORMAT: DateFieldFormat = "DD.MM.YYYY";

export function isDateFieldFormat(v: unknown): v is DateFieldFormat {
  return typeof v === "string" && (DATE_FIELD_FORMATS as readonly string[]).includes(v);
}

export function sanitizeDateFieldFormat(v: unknown): DateFieldFormat {
  return isDateFieldFormat(v) ? v : DEFAULT_DATE_FIELD_FORMAT;
}

export function fieldOrder(fmt: DateFieldFormat): DateFieldOrder {
  return fmt.startsWith("YYYY") ? "ymd" : fmt.startsWith("MM") ? "mdy" : "dmy";
}

export function fieldSep(fmt: DateFieldFormat): DateFieldSep {
  return fmt[2] === "Y" ? (fmt[4] as DateFieldSep) : (fmt[2] as DateFieldSep);
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** ISO → text in the chosen format; "" for empty/invalid. */
export function formatDateField(iso: string, fmt: DateFieldFormat): string {
  const m = ISO_RE.exec(iso || "");
  if (!m || !validYmd(+m[1], +m[2], +m[3])) return "";
  const sep = fieldSep(fmt);
  const [y, mo, d] = [m[1], m[2], m[3]];
  switch (fieldOrder(fmt)) {
    case "ymd":
      return [y, mo, d].join(sep);
    case "mdy":
      return [mo, d, y].join(sep);
    default:
      return [d, mo, y].join(sep);
  }
}

/**
 * Typed text → ISO, or null if not a real date. Any of . - / or spaces is
 * accepted as separator; day/month may be one digit. The order is the one of
 * the format; a 4-digit first part is always read as Y-M-D (ISO paste).
 */
export function parseDateField(text: string, fmt: DateFieldFormat): string | null {
  const parts = (text || "").trim().split(/[.\-/\s]+/);
  if (parts.length !== 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  let order = fieldOrder(fmt);
  if (parts[0].length === 4) order = "ymd";
  const [a, b, c] = parts;
  const [ys, ms, ds] = order === "ymd" ? [a, b, c] : order === "mdy" ? [c, a, b] : [c, b, a];
  if (ys.length !== 4 || ms.length > 2 || ds.length > 2) return null;
  const y = +ys;
  const m = +ms;
  const d = +ds;
  if (!validYmd(y, m, d)) return null;
  return `${y}-${p2(m)}-${p2(d)}`;
}

/** Placeholder like "ДД.ММ.ГГГГ" / "DD.MM.YYYY". */
export function dateFieldPlaceholder(fmt: DateFieldFormat, lang: string): string {
  if (lang !== "ru") return fmt;
  return fmt.replace(/YYYY/, "ГГГГ").replace(/MM/, "ММ").replace(/DD/, "ДД");
}
