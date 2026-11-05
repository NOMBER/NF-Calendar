import {
  MODAL_HANDOFF_MS,
  afterModalClose,
  navigatorMonthAction,
} from "../modals/modalHandoff";

describe("navigatorMonthAction", () => {
  it("maps mode to the month-click intent (calendar vs statistics)", () => {
    expect(navigatorMonthAction("calendar")).toBe("goToMonth");
    expect(navigatorMonthAction("stats")).toBe("showStats");
  });
});

describe("afterModalClose (Modal→Modal handoff)", () => {
  it("defers showStats after close so the new modal is not dismissed by the same click", () => {
    const calls: string[] = [];
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    afterModalClose(
      () => calls.push("close"),
      () => calls.push("showStats"),
      MODAL_HANDOFF_MS,
      (fn, ms) => {
        scheduled.push({ fn, ms });
      },
    );
    expect(calls).toEqual(["close"]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe(MODAL_HANDOFF_MS);
    expect(MODAL_HANDOFF_MS).toBeGreaterThan(0);
    scheduled[0].fn();
    expect(calls).toEqual(["close", "showStats"]);
  });

  it("runs next immediately when delay is 0 (calendar path)", () => {
    const calls: string[] = [];
    afterModalClose(
      () => calls.push("close"),
      () => calls.push("go"),
      0,
      () => {
        throw new Error("should not schedule");
      },
    );
    expect(calls).toEqual(["close", "go"]);
  });
});

/**
 * Mock-DOM wiring for the three top buttons in the Go to date modal:
 * mode buttons set target; month cells call the handoff for stats.
 */
describe("date navigator mode button wiring (mock DOM)", () => {
  type El = {
    cls: string;
    text: string;
    active: boolean;
    listeners: Record<string, Array<() => void>>;
    toggleClass: (name: string, on: boolean) => void;
    setAttr: (k: string, v: string) => void;
    addEventListener: (type: string, fn: () => void) => void;
    click: () => void;
  };

  function makeButton(cls: string, text: string): El {
    const el: El = {
      cls,
      text,
      active: false,
      listeners: {},
      toggleClass(name, on) {
        if (name === "is-active") el.active = on;
      },
      setAttr() {
        /* noop */
      },
      addEventListener(type, fn) {
        (el.listeners[type] ??= []).push(fn);
      },
      click() {
        for (const fn of el.listeners.click ?? []) fn();
      },
    };
    return el;
  }

  /** Mirrors DateNavigatorModal mode + month wiring (no Obsidian Modal). */
  function wire(state: { target: "calendar" | "stats" }) {
    const modes: El[] = [];
    const monthClicks: string[] = [];
    const schedule: Array<() => void> = [];

    (["calendar", "stats"] as const).forEach((m) => {
      const b = makeButton("cwt-nav-mode", m);
      b.toggleClass("is-active", state.target === m);
      b.addEventListener("click", () => {
        state.target = m;
        modes.forEach((btn) => btn.toggleClass("is-active", btn.text === state.target));
      });
      modes.push(b);
    });

    const nov = makeButton("cwt-nav-cell", "Nov");
    nov.addEventListener("click", () => {
      const action = navigatorMonthAction(state.target);
      if (action === "showStats") {
        afterModalClose(
          () => monthClicks.push("close"),
          () => monthClicks.push("showStats"),
          MODAL_HANDOFF_MS,
          (fn) => schedule.push(fn),
        );
      } else {
        monthClicks.push("close");
        monthClicks.push("goToMonth");
      }
    });

    return { modes, nov, monthClicks, schedule };
  }

  it("Open statistics sets mode; month click then schedules showStats (not goToMonth)", () => {
    const state = { target: "calendar" as "calendar" | "stats" };
    const { modes, nov, monthClicks, schedule } = wire(state);

    expect(modes[0].active).toBe(true);
    expect(modes[1].active).toBe(false);

    modes[1].click(); // Open statistics
    expect(state.target).toBe("stats");
    expect(modes[1].active).toBe(true);
    expect(modes[0].active).toBe(false);

    nov.click();
    expect(monthClicks).toEqual(["close"]);
    expect(schedule).toHaveLength(1);
    schedule[0]();
    expect(monthClicks).toEqual(["close", "showStats"]);
  });

  it("Open in calendar: month click goes to month immediately", () => {
    const state = { target: "calendar" as "calendar" | "stats" };
    const { nov, monthClicks, schedule } = wire(state);
    nov.click();
    expect(monthClicks).toEqual(["close", "goToMonth"]);
    expect(schedule).toHaveLength(0);
  });
});
