import { preserveView } from "../preserveView";

const ctl = () => ({
  focused: false,
  focus(o?: { preventScroll?: boolean }) {
    this.focused = !!o?.preventScroll;
  },
});

describe("preserveView (settings re-render keeps place)", () => {
  it("restores scrollTop of root and scrolled ancestors and refocuses by position", () => {
    const outer = { scrollTop: 40, parentElement: null };
    let controls = [ctl(), ctl(), ctl()];
    const doc = { activeElement: controls[1] as unknown };
    const root = {
      scrollTop: 900,
      parentElement: outer,
      ownerDocument: doc,
      querySelectorAll: () => controls,
    };
    preserveView(root, () => {
      // display(): empties the pane, browser resets scroll, new controls
      root.scrollTop = 0;
      outer.scrollTop = 0;
      controls = [ctl(), ctl(), ctl(), ctl()];
    });
    expect(root.scrollTop).toBe(900);
    expect(outer.scrollTop).toBe(40);
    expect(controls[1].focused).toBe(true);
    expect(controls[0].focused).toBe(false);
  });

  it("no focus inside: just scroll", () => {
    const root = {
      scrollTop: 5,
      parentElement: null,
      ownerDocument: { activeElement: {} },
      querySelectorAll: () => [],
    };
    preserveView(root, () => (root.scrollTop = 0));
    expect(root.scrollTop).toBe(5);
  });
});
