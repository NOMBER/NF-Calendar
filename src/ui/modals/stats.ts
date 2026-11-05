import type { Moment } from "moment";
import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { IStatsPanelDeps } from "src/ui/modals/statsPanel";
import { StatsPanel } from "src/ui/modals/statsPanel";

export type { IStatsPanelDeps as IStatsDeps };

/**
 * Standalone month statistics modal (⋯ menu / command palette).
 * UI lives in StatsPanel so the Go-to-date navigator can embed the same view.
 */
export class StatsModal extends Modal {
  private panel: StatsPanel | null = null;

  constructor(
    app: App,
    private deps: IStatsPanelDeps,
    private month?: Moment,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("cwt-stats-modal");
    this.titleEl.setText(t("stats.title"));
    this.panel = new StatsPanel(this.app, this.contentEl, {
      ...this.deps,
      openDay: (date) => {
        this.close();
        this.deps.openDay(date);
      },
    }, this.month);
    void this.panel.render();
  }

  onClose(): void {
    this.panel?.destroy();
    this.panel = null;
    this.contentEl.empty();
  }
}
