import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  injectAgentSessionCollector,
  injectAgentSpendBackfill,
  injectCodexSessionCollector,
  injectCodexSpendBackfill,
  injectGitCollector,
} from '../../collectors';
import { injectProjectLinks } from '../project-links';
import { AgentSessionResyncComponent } from './agent-session-resync.component';
import { AttributionRulesComponent } from './attribution-rules.component';
import { ProjectPathsComponent } from './project-paths.component';
import { YourProjectsComponent } from './your-projects.component';
import { injectTimetrackSettings } from './settings';

@Component({
  selector: 'ethlete-settings-projects-view',
  template: `
    <div class="flex flex-col gap-8 py-6">
      <ethlete-your-projects
        [projects]="store.settings().favoriteProjects"
        [backgroundKeys]="store.settings().backgroundProjects"
        (projectsChange)="store.setFavoriteProjects($event)"
        (backgroundKeysChange)="store.setBackgroundProjects($event)"
        class="max-w-4xl"
      />

      <ethlete-project-paths
        [repoPaths]="repoPaths()"
        [links]="store.settings().projectLinks"
        [projects]="store.settings().favoriteProjects"
        (addLink)="store.addProjectLink($event)"
        (remove)="store.removeProjectLink($event)"
      />

      <ethlete-agent-session-resync
        [unlinked]="agent.totals().unlinked"
        [links]="projectLinks()"
        [busy]="agent.isCollecting()"
        (resync)="resync($event)"
        class="max-w-4xl"
      />

      <ethlete-attribution-rules
        [rules]="store.settings().attributionRules"
        (remove)="store.removeAttributionRule($event)"
        class="max-w-4xl"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AgentSessionResyncComponent, AttributionRulesComponent, ProjectPathsComponent, YourProjectsComponent],
})
export class SettingsProjectsViewComponent {
  protected store = injectTimetrackSettings();

  public git = injectGitCollector();
  protected projectLinks = injectProjectLinks();
  protected agent = injectAgentSessionCollector();
  private agentSpend = injectAgentSpendBackfill();
  private codex = injectCodexSessionCollector();
  private codexSpend = injectCodexSpendBackfill();

  protected repoPaths = computed(() => this.git.discovery()?.repos ?? []);

  /** Every pass over the logs reads the checkout again: one per agent for its sessions, one for their spend. */
  protected resync(paths: readonly string[]) {
    this.agent.resync(paths);
    this.agentSpend.resync(paths);
    this.codex.resync(paths);
    this.codexSpend.resync(paths);
  }
}
