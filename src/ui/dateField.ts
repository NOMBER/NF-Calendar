import { setIcon } from "obsidian";

import { dateFieldPlaceholder, formatDateField, parseDateField } from "src/core/dateField";
import type { DateFieldFormat } from "src/core/dateField";
import { getLanguage, t } from "src/core/i18n";

export interface IDateField {
  inputEl: HTMLInputElement;
  /** ISO date, "" when empty, null when the text is not a valid date. */
  getValue(): string | null;
  setValue(iso: string): void;
}

/**
 * Text date field in the user's order (Settings → Date field format) with a
 * picker button. Values in and out are ISO YYYY-MM-DD.
 */
export function createDateField(
  parent: HTMLElement,
  opts: {
    value: string;
    format: DateFieldFormat;
    label?: string;
    onChange?: (iso: string) => void;
    onInput?: () => void;
  },
): IDateField {
  const wrap = parent.createSpan("cwt-date-field");
  const inputEl = wrap.createEl("input", {
    type: "text",
    cls: "cwt-date-input",
    attr: {
      placeholder: dateFieldPlaceholder(opts.format, getLanguage()),
      inputmode: "numeric",
      maxlength: "10",
      ...(opts.label ? { "aria-label": opts.label } : {}),
    },
  });
  inputEl.value = formatDateField(opts.value, opts.format);
  const getValue = () => {
    const txt = inputEl.value.trim();
    return txt === "" ? "" : parseDateField(txt, opts.format);
  };
  const mark = () => {
    const v = getValue();
    inputEl.toggleClass("is-invalid", v === null);
    inputEl.setAttr("aria-invalid", String(v === null));
    return v;
  };
  inputEl.addEventListener("input", () => {
    mark();
    opts.onInput?.();
  });
  inputEl.addEventListener("change", () => {
    const v = mark();
    if (v === null) return;
    if (v) inputEl.value = formatDateField(v, opts.format); // normalize "1.2.2027"
    opts.onChange?.(v);
  });

  // Native picker only as a popup; wrap it so we do not fight Obsidian input styles.
  const pickerWrap = wrap.createSpan("cwt-date-picker-native-wrap");
  const picker = pickerWrap.createEl("input", {
    type: "date",
    cls: "cwt-date-picker-native",
    attr: { tabindex: "-1", "aria-hidden": "true" },
  });
  const btn = wrap.createEl("button", {
    cls: "clickable-icon cwt-date-picker-btn",
    attr: { type: "button", "aria-label": t("dateField.pick") },
  });
  setIcon(btn, "calendar");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    picker.value = getValue() || "";
    try {
      (picker as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      inputEl.focus();
    }
  });
  picker.addEventListener("change", () => {
    if (!picker.value) return;
    inputEl.value = formatDateField(picker.value, opts.format);
    mark();
    opts.onInput?.();
    opts.onChange?.(picker.value);
  });

  return {
    inputEl,
    getValue,
    setValue: (iso: string) => {
      inputEl.value = formatDateField(iso, opts.format);
      mark();
    },
  };
}
