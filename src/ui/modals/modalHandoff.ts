/**
 * After closing one Obsidian Modal, wait this long before opening another.
 * A same-click mouseup / modal teardown otherwise dismisses the new Modal
 * immediately (setTimeout(0) is not enough for Modal→Modal; Menu→Modal is OK at 0).
 */
export const MODAL_HANDOFF_MS = 100;

export type NavigatorTarget = "calendar" | "stats";

/** What a month-cell click should do for the current mode. */
export function navigatorMonthAction(target: NavigatorTarget): "goToMonth" | "showStats" {
  return target === "stats" ? "showStats" : "goToMonth";
}

/**
 * Close the current modal, then run `next` after `delayMs`.
 * Inject `schedule` in tests.
 */
export function afterModalClose(
  close: () => void,
  next: () => void,
  delayMs: number,
  schedule: (fn: () => void, ms: number) => unknown = (fn, ms) =>
    window.setTimeout(fn, ms),
): void {
  close();
  if (delayMs <= 0) {
    next();
    return;
  }
  schedule(next, delayMs);
}
