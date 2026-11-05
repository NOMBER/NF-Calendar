import { Menu } from "obsidian";

type Active = { key: string; menu: Menu };

let active: Active | null = null;

export type MenuAnchor = MouseEvent | { x: number; y: number };

/**
 * Show at most one Obsidian Menu for the plugin at a time.
 * Hides any previous Menu before opening. With `toggle: true`, a second
 * open of the same `key` while that Menu is still the active one closes it
 * and does not reopen (filter button, ⋯ button).
 */
export function showExclusiveMenu(
  key: string,
  configure: (menu: Menu) => void,
  at: MenuAnchor,
  opts?: { toggle?: boolean },
): void {
  if (active) {
    const prev = active;
    active = null;
    try {
      prev.menu.hide();
    } catch {
      /* already dismissed */
    }
    if (opts?.toggle && prev.key === key) {
      return;
    }
  }
  const menu = new Menu();
  configure(menu);
  active = { key, menu };
  menu.onHide(() => {
    if (active?.menu === menu) {
      active = null;
    }
  });
  if (isMouseEvent(at)) {
    menu.showAtMouseEvent(at);
  } else {
    menu.showAtPosition(at);
  }
}

export function hideExclusiveMenu(): void {
  if (!active) return;
  const prev = active;
  active = null;
  try {
    prev.menu.hide();
  } catch {
    /* already dismissed */
  }
}

/** Test helper — active menu key, or null. */
export function exclusiveMenuKey(): string | null {
  return active?.key ?? null;
}

/** Test helper — clear singleton without calling hide(). */
export function resetExclusiveMenuForTests(): void {
  active = null;
}

function isMouseEvent(at: MenuAnchor): at is MouseEvent {
  return typeof MouseEvent !== "undefined" && at instanceof MouseEvent;
}
