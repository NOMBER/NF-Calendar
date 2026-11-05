/**
 * Runs a full re-render of `root` (e.g. a settings tab's display()) without
 * the jump to the top: scroll offsets of `root` and its scrolled ancestors
 * are restored, and the control that had focus (by its position among the
 * focusable controls) gets focus back without scrolling.
 */

const FOCUSABLE = "input, select, textarea, button, [tabindex]";

interface IScrollable {
  scrollTop: number;
  parentElement: IScrollable | null;
}

export interface IPreserveRoot extends IScrollable {
  querySelectorAll(sel: string): ArrayLike<unknown>;
  ownerDocument?: { activeElement: unknown } | null;
}

export function preserveView(root: IPreserveRoot, rerender: () => void): void {
  const saved: [IScrollable, number][] = [];
  for (let el: IScrollable | null = root; el; el = el.parentElement) {
    if (el === root || el.scrollTop > 0) saved.push([el, el.scrollTop]);
  }
  const active = root.ownerDocument?.activeElement ?? null;
  const before = Array.from(root.querySelectorAll(FOCUSABLE));
  const focusIndex = active ? before.indexOf(active) : -1;

  rerender();

  for (const [el, top] of saved) el.scrollTop = top;
  if (focusIndex >= 0) {
    const after = root.querySelectorAll(FOCUSABLE)[focusIndex] as
      { focus?: (o?: { preventScroll?: boolean }) => void } | undefined;
    after?.focus?.({ preventScroll: true });
  }
}
