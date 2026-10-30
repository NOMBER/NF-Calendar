import { makeDefaultSettings } from "src/settingsData";
import type { ISettings } from "src/settingsData";

export function getDefaultSettings(overrides: Partial<ISettings> = {}): ISettings {
  return { ...makeDefaultSettings(), shouldConfirmBeforeCreate: false, ...overrides };
}
