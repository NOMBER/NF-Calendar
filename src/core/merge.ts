/** Merging a rendered template into an existing note (pure). */

export type MergeMode = "append" | "prepend" | "replace";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/;

export function isEffectivelyEmpty(text: string): boolean {
  return !text || text.trim().length === 0;
}

/** Split a note into its leading YAML frontmatter block (if any) and the rest. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const m = FRONTMATTER.exec(text || "");
  if (!m) {
    return { frontmatter: "", body: text || "" };
  }
  return { frontmatter: m[0], body: text.slice(m[0].length) };
}

/**
 * Combine an existing note with a rendered template.
 *
 * - empty note (only whitespace): the template replaces it in every mode
 * - append:  existing + blank line + template
 * - prepend: template + blank line + existing; if the existing note starts
 *            with YAML frontmatter, the template goes right AFTER it so the
 *            frontmatter stays first and valid
 * - replace: template only
 */
export function mergeTemplate(existing: string, rendered: string, mode: MergeMode): string {
  if (isEffectivelyEmpty(existing) || mode === "replace") {
    return rendered;
  }
  if (isEffectivelyEmpty(rendered)) {
    return existing;
  }
  if (mode === "append") {
    const base = trimTrailingBlankLines(existing);
    return `${base}\n\n${rendered.replace(/^\s*\n/, "")}`;
  }
  const { frontmatter, body } = splitFrontmatter(existing);
  const tpl = trimTrailingBlankLines(rendered);
  const rest = body.replace(/^\s*\n/, "");
  if (frontmatter) {
    const fm = frontmatter.endsWith("\n") ? frontmatter : `${frontmatter}\n`;
    return rest ? `${fm}${tpl}\n\n${rest}` : `${fm}${tpl}\n`;
  }
  return `${tpl}\n\n${rest}`;
}

/** Remove trailing newlines/blank lines but keep spaces on the last line ("- [ ] "). */
function trimTrailingBlankLines(text: string): string {
  return text.replace(/(\r?\n[ \t]*)+$/, "");
}
