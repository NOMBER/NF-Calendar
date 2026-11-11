import { hexToRgb, isCustomColor } from "src/core/important";

const COLOR_ATTRS = ["data-cwt-color", "data-cwt-important", "data-cwt-prepare"] as const;

/** Set CSS variables for a custom hex colour; presets are styled from styles.css. */
export function applyColorVar(el: HTMLElement, color: string): void {
  if (isCustomColor(color)) {
    const rgb = hexToRgb(color);
    el.style.setProperty("--cwt-c", color.toLowerCase());
    if (rgb) {
      el.style.setProperty("--cwt-c-rgb", rgb.join(", "));
    }
  } else {
    el.style.removeProperty("--cwt-c");
    el.style.removeProperty("--cwt-c-rgb");
  }
}

export function setColorAttr(el: HTMLElement, attr: (typeof COLOR_ATTRS)[number], color: string): void {
  el.setAttr(attr, color);
  applyColorVar(el, color);
}

/** Walk a tree and apply CSS variables on any element that carries a colour attr. */
export function applyColorVarsIn(root: ParentNode | Document | null | undefined): void {
  if (!root) {
    return;
  }
  const sel = COLOR_ATTRS.map((a) => `[${a}]`).join(", ");
  root.querySelectorAll(sel).forEach((node) => {
    if (!(node.instanceOf(HTMLElement))) {
      return;
    }
    const color = COLOR_ATTRS.map((a) => node.getAttribute(a)).find((v) => !!v);
    if (color) {
      applyColorVar(node, color);
    }
  });
}
