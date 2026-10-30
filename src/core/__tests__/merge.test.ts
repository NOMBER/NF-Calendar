import { isEffectivelyEmpty, mergeTemplate, splitFrontmatter } from "../merge";

const tpl = "## Plan\n- [ ] ";

describe("mergeTemplate", () => {
  it("empty note: template is inserted in every mode", () => {
    for (const mode of ["append", "prepend", "replace"] as const) {
      expect(mergeTemplate("  \n", tpl, mode)).toBe(tpl);
    }
    expect(isEffectivelyEmpty(" \n\t")).toBe(true);
  });

  it("append keeps existing text and adds one blank line", () => {
    expect(mergeTemplate("Notes\n\n\n", tpl, "append")).toBe(`Notes\n\n${tpl}`);
  });

  it("prepend puts the template first", () => {
    expect(mergeTemplate("Notes", tpl, "prepend")).toBe(`${tpl}\n\nNotes`);
  });

  it("prepend keeps YAML frontmatter at the top", () => {
    const existing = "---\ntags: [daily]\n---\nNotes";
    expect(mergeTemplate(existing, tpl, "prepend")).toBe(`---\ntags: [daily]\n---\n${tpl}\n\nNotes`);
    expect(mergeTemplate("---\na: 1\n---\n", tpl, "prepend")).toBe(`---\na: 1\n---\n${tpl}\n`);
  });

  it("replace returns the template", () => {
    expect(mergeTemplate("old", tpl, "replace")).toBe(tpl);
  });

  it("empty template leaves the note untouched", () => {
    expect(mergeTemplate("Notes", "", "append")).toBe("Notes");
  });

  it("splitFrontmatter", () => {
    expect(splitFrontmatter("no fm")).toEqual({ frontmatter: "", body: "no fm" });
    expect(splitFrontmatter("---\na: 1\n---\nbody").body).toBe("body");
  });
});
