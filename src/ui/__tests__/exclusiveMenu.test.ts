jest.mock(
  "obsidian",
  () => {
    const menus: Array<{
      hide: jest.Mock;
      onHide: jest.Mock;
      showAtMouseEvent: jest.Mock;
      showAtPosition: jest.Mock;
      _onHide?: () => void;
    }> = [];
    (global as unknown as { __exclusiveMenus: typeof menus }).__exclusiveMenus = menus;
    return {
      Menu: jest.fn().mockImplementation(() => {
        const menu = {
          hide: jest.fn(() => {
            menu._onHide?.();
          }),
          onHide: jest.fn((cb: () => void) => {
            menu._onHide = cb;
          }),
          showAtMouseEvent: jest.fn(),
          showAtPosition: jest.fn(),
          _onHide: undefined as (() => void) | undefined,
        };
        menus.push(menu);
        return menu;
      }),
    };
  },
  { virtual: true },
);

import {
  exclusiveMenuKey,
  hideExclusiveMenu,
  resetExclusiveMenuForTests,
  showExclusiveMenu,
} from "../exclusiveMenu";

type FakeMenu = {
  hide: jest.Mock;
  onHide: jest.Mock;
  showAtMouseEvent: jest.Mock;
  showAtPosition: jest.Mock;
  _onHide?: () => void;
};

function menus(): FakeMenu[] {
  return (global as unknown as { __exclusiveMenus: FakeMenu[] }).__exclusiveMenus;
}

beforeEach(() => {
  menus().length = 0;
  resetExclusiveMenuForTests();
  jest.clearAllMocks();
});

describe("showExclusiveMenu", () => {
  it("hides the previous menu before opening another (no stacking)", () => {
    showExclusiveMenu("a", () => undefined, { x: 1, y: 2 });
    expect(exclusiveMenuKey()).toBe("a");
    expect(menus()).toHaveLength(1);
    expect(menus()[0].showAtPosition).toHaveBeenCalledWith({ x: 1, y: 2 });

    showExclusiveMenu("b", () => undefined, { x: 3, y: 4 });
    expect(menus()[0].hide).toHaveBeenCalled();
    expect(exclusiveMenuKey()).toBe("b");
    expect(menus()).toHaveLength(2);
    expect(menus()[1].showAtPosition).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it("toggle: same key while open closes and does not reopen", () => {
    showExclusiveMenu("filter", () => undefined, { x: 0, y: 0 }, { toggle: true });
    expect(exclusiveMenuKey()).toBe("filter");
    showExclusiveMenu("filter", () => undefined, { x: 0, y: 0 }, { toggle: true });
    expect(menus()[0].hide).toHaveBeenCalled();
    expect(exclusiveMenuKey()).toBeNull();
    expect(menus()).toHaveLength(1);
  });

  it("onHide clears the active reference", () => {
    showExclusiveMenu("day", () => undefined, { x: 0, y: 0 });
    expect(exclusiveMenuKey()).toBe("day");
    menus()[0]._onHide?.();
    expect(exclusiveMenuKey()).toBeNull();
  });

  it("hideExclusiveMenu dismisses the active menu", () => {
    showExclusiveMenu("week", () => undefined, { x: 0, y: 0 });
    hideExclusiveMenu();
    expect(menus()[0].hide).toHaveBeenCalled();
    expect(exclusiveMenuKey()).toBeNull();
  });
});
