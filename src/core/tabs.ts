/** 2.8.0: where today's note goes as a new tab on startup. */
export type StartupTabPosition = "left" | "right";
export const STARTUP_TAB_POSITIONS: StartupTabPosition[] = ["left", "right"];

/**
 * Index for a new tab placed "left": right after the last pinned tab of the
 * group (0 if none is pinned). `pinned` lists the group's tabs in order.
 */
export function startupInsertIndex(pinned: readonly boolean[]): number {
  return pinned.lastIndexOf(true) + 1;
}
