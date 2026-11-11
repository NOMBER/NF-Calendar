/** True when `node` is an HTMLElement, including nodes from a popout window. */
export function isHtmlElement(node: EventTarget | Node | null | undefined): node is HTMLElement {
  return !!node && typeof (node as HTMLElement).instanceOf === "function" && (node as HTMLElement).instanceOf(HTMLElement);
}
