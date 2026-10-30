import { AbstractInputSuggest, TFile } from "obsidian";
import type { App } from "obsidian";

/**
 * Autocomplete over the vault's markdown files for a text input.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFile[] {
    const q = query.toLowerCase().trim();
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 100);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    // Let the Setting's onChange handler see the new value.
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}
