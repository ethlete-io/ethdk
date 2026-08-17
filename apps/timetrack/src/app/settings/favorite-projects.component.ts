import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { TimetrackFavoriteProject } from '@ethlete/timetrack';
import { injectJiraCatalog } from '../jira';
import { ExplainComponent } from './explain.component';

const WHY = `Two things read this list. A branch name or a window title may only name an issue in one of
these projects, which is what stops a branch called chore/angular-22 from being logged against issue
ANGULAR-22, and a cloud console's own identifiers from being read as issue keys at all. And every issue
picker in the app offers these projects and no others, so the list you scroll is the work you do.

Leaving it empty is not neutral. No issue key in free text is trusted then, and the pickers have nothing
to offer.`;

/**
 * The projects this machine works in, picked from the instance.
 *
 * It is a picker rather than a text field on purpose. The keys used to be typed from memory, and a key
 * typed one character wrong is silent: nothing rejects it, the branch grammar simply stops matching, and
 * the day quietly loses the work it should have named.
 */
@Component({
  selector: 'ethlete-favorite-projects',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Your projects</h3>
        <ethlete-explain [text]="WHY" label="your projects" />
      </div>

      <et-form-field appearance="underline" size="sm">
        <et-label>Projects</et-label>
        <et-select
          [value]="picked()"
          [loading]="catalog.isLoadingProjects()"
          [error]="catalog.projectFailure()"
          (valueChange)="pick($event)"
          (openChange)="opened($event)"
          placeholder="Pick the projects you work in"
          multiple
        >
          <input etSelectSearch placeholder="Search projects" />

          @for (project of offered(); track project.key) {
            <et-select-option [value]="project.key" [label]="project.key + ' ' + project.name">
              <span class="flex min-w-0 items-baseline gap-2">
                <span class="shrink-0 text-mono text-small">{{ project.key }}</span>
                <span class="min-w-0 grow truncate text-small">{{ project.name }}</span>
              </span>
            </et-select-option>
          }
        </et-select>
        <et-hint>Without one of these, a branch name has to carry the whole issue key to be read.</et-hint>
      </et-form-field>

      @if (catalog.isLoadingProjects()) {
        <div class="flex items-center gap-3 text-et-surface-muted">
          <et-spinner size="sm" />
          <span class="text-small">Reading the instance's projects…</span>
        </div>
      }

      @if (catalog.projectFailure(); as failure) {
        <et-banner [description]="failure" type="warning" heading="The projects could not be read" />
        <div>
          <button (click)="catalog.reloadProjects()" et-button variant="outline" size="sm">Read them again</button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, ExplainComponent, FORM_FIELD_IMPORTS, SELECT_IMPORTS, SpinnerComponent],
})
export class FavoriteProjectsComponent {
  protected catalog = injectJiraCatalog();
  public projects = input.required<readonly TimetrackFavoriteProject[]>();

  /** What the picker chose, whole. The document holds a list, so the list is what is written. */
  public projectsChange = output<readonly { key: string; name?: string }[]>();
  protected readonly WHY = WHY;

  protected picked = computed(() => this.projects().map((project) => project.key));

  /**
   * What the list offers: the instance's projects, and the picked ones ahead of them.
   *
   * A picked project the instance has not reported still has to be in the list, or opening this screen
   * offline — or with an expired token — would show every one of them as unpicked and one press would
   * write that away.
   */
  protected offered = computed<TimetrackFavoriteProject[]>(() => {
    const found = new Map<string, TimetrackFavoriteProject>();

    for (const project of this.projects()) found.set(project.key, project);

    for (const project of this.catalog.projects()) {
      if (!found.has(project.key)) found.set(project.key, { key: project.key, name: project.name });
    }

    return [...found.values()];
  });

  protected opened(open: boolean) {
    if (open) this.catalog.loadProjects();
  }

  protected pick(value: unknown) {
    const keys = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    const byKey = new Map(this.offered().map((project) => [project.key, project]));

    this.projectsChange.emit(keys.map((key) => byKey.get(key) ?? { key }));
  }
}
