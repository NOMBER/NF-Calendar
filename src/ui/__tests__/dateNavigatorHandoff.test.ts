/**
 * @jest-environment jsdom
 *
 * Legacy Modal→Modal handoff helpers remain for any remaining callers, but
 * Go-to-date no longer opens a second stats modal (in-place panel instead).
 */
import {
  MODAL_HANDOFF_MS,
  afterModalClose,
  navigatorMonthAction,
} from "../modals/modalHandoff";

describe("modalHandoff helpers (kept for compatibility)", () => {
  it("maps calendar → goToMonth; stats target still maps to showStats", () => {
    expect(navigatorMonthAction("calendar")).toBe("goToMonth");
    expect(navigatorMonthAction("stats")).toBe("showStats");
  });

  it("afterModalClose still sequences close then action", () => {
    jest.useFakeTimers();
    const calls: string[] = [];
    const scheduled: { ms: number }[] = [];
    const realSetTimeout = window.setTimeout.bind(window);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).setTimeout = (fn: () => void, ms: number) => {
      scheduled.push({ ms });
      return realSetTimeout(fn, ms);
    };
    afterModalClose(
      () => calls.push("close"),
      () => calls.push("showStats"),
      MODAL_HANDOFF_MS,
    );
    expect(calls).toEqual(["close"]);
    jest.advanceTimersByTime(MODAL_HANDOFF_MS);
    expect(scheduled[0].ms).toBe(MODAL_HANDOFF_MS);
    expect(MODAL_HANDOFF_MS).toBeGreaterThan(0);
    expect(calls).toEqual(["close", "showStats"]);
    jest.useRealTimers();
  });
});
