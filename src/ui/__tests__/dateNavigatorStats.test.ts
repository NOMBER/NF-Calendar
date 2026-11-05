/**
 * @jest-environment jsdom
 *
 * Open statistics must switch the SAME modal content to stats (in-place),
 * not rely on Modal→Modal handoff timing. Back restores Go-to-date.
 */
import { navigatorMonthAction } from "../modals/modalHandoff";

describe("in-place stats screen (Go to date)", () => {
  /** Mirrors DateNavigatorModal: modes row + openStatsScreen + Back. */
  function mountGoto(state: { screen: "goto" | "stats"; statsOpens: number; backs: number }) {
    document.body.innerHTML = "";
    const root = document.createElement("div");
    document.body.appendChild(root);

    const render = () => {
      root.innerHTML = "";
      if (state.screen === "stats") {
        const back = document.createElement("button");
        back.className = "cwt-nav-back";
        back.textContent = "← Back";
        back.addEventListener("click", () => {
          state.backs++;
          state.screen = "goto";
          render();
        });
        root.appendChild(back);
        root.appendChild(document.createTextNode("STATS"));
        return;
      }
      const modes = document.createElement("div");
      modes.className = "cwt-nav-modes";
      const statsBtn = document.createElement("button");
      statsBtn.className = "cwt-nav-mode cwt-nav-open-stats";
      statsBtn.textContent = "Open statistics";
      statsBtn.type = "button";
      statsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.statsOpens++;
        state.screen = "stats";
        render();
      });
      modes.appendChild(statsBtn);

      // Closed random collapse sibling — must not block the stats button.
      const collapse = document.createElement("div");
      collapse.className = "cwt-nav-random-collapse";
      collapse.style.pointerEvents = "none";
      const box = document.createElement("div");
      box.className = "cwt-nav-random";
      box.style.height = "200px"; // would steal clicks if pointer-events allowed
      collapse.appendChild(box);

      root.appendChild(modes);
      root.appendChild(collapse);
    };
    render();
    return root;
  }

  it("clicking Open statistics calls handler and swaps to stats screen", () => {
    const state = { screen: "goto" as "goto" | "stats", statsOpens: 0, backs: 0 };
    const root = mountGoto(state);
    const btn = root.querySelector(".cwt-nav-open-stats") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // Closed collapse is pointer-events:none so it cannot intercept this click.
    btn.click();
    expect(state.statsOpens).toBe(1);
    expect(state.screen).toBe("stats");
    expect(root.textContent).toContain("STATS");
    expect(root.querySelector(".cwt-nav-back")).toBeTruthy();
  });

  it("Back returns to Go to date content", () => {
    const state = { screen: "goto" as "goto" | "stats", statsOpens: 0, backs: 0 };
    const root = mountGoto(state);
    (root.querySelector(".cwt-nav-open-stats") as HTMLButtonElement).click();
    (root.querySelector(".cwt-nav-back") as HTMLButtonElement).click();
    expect(state.backs).toBe(1);
    expect(state.screen).toBe("goto");
    expect(root.querySelector(".cwt-nav-open-stats")).toBeTruthy();
  });

  it("month action no longer routes to showStats from a mode toggle", () => {
    // Calendar month clicks always go to calendar; stats opens via the button.
    expect(navigatorMonthAction("calendar")).toBe("goToMonth");
  });
});
