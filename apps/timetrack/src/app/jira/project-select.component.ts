import { Component, ViewEncapsulation, booleanAttribute, computed, input, output } from '@angular/core';
import { SELECT_IMPORTS } from '@ethlete/components';
import { injectJiraCatalog } from './jira-catalog';
import { injectTimetrackSettings } from '../settings/settings';

type ProjectOption = { key: string; name: string; label: string };

/**
 * Picks one Jira project.
 *
 * It offers the projects the user picked, because an instance has hundreds and a person works in a
 * handful — the rest are projects nobody has touched in years, and a list holding them is a list that
 * has to be searched rather than read. `all` offers every project the token can see, which is what the
 * settings screen picks the favourites out of.
 *
 * A machine with no favourite picked yet falls back to the whole list rather than to an empty one: the
 * unconfigured state has to be usable, or the setting that fixes it could never be reached. A typed key
 * is accepted for the same reason: a project outside the favourites, and a machine that cannot reach
 * Jira at all, both still have to be answerable.
 */
@Component({
  selector: 'ethlete-project-select',
  template: `
    <et-select
      [value]="value() || null"
      [placeholder]="placeholder()"
      [loading]="reads() && catalog.isLoadingProjects()"
      [error]="reads() ? catalog.projectFailure() : null"
      [aria-label]="ariaLabel()"
      (valueChange)="pick($event)"
      (openChange)="opened($event)"
      allowCustomValues
    >
      <!-- a single select with an inline search shows its value in that input, so its placeholder is
           the one the closed field reads -->
      <input [placeholder]="placeholder()" etSelectSearch />

      @for (option of options(); track option.key) {
        <et-select-option [value]="option.key" [label]="option.label">
          <span class="flex min-w-0 items-baseline gap-2">
            <span class="shrink-0 text-mono text-small">{{ option.key }}</span>
            <span class="min-w-0 grow truncate text-small">{{ option.name }}</span>
          </span>
        </et-select-option>
      }
    </et-select>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SELECT_IMPORTS],
})
export class ProjectSelectComponent {
  protected catalog = injectJiraCatalog();
  private settings = injectTimetrackSettings();
  public value = input('');
  public placeholder = input('Pick a project');
  public ariaLabel = input<string | null>(null);
  /** Offer every project the instance holds rather than only the picked ones. */
  public all = input(false, { transform: booleanAttribute });

  public valueChange = output<string>();

  private favorites = computed(() => this.settings.settings().favoriteProjects);

  /** Whether this instance of the picker calls Jira at all, or reads the picked list it already has. */
  protected reads = computed(() => this.all() || this.favorites().length === 0);

  protected options = computed(() => (this.reads() ? this.catalog.projects() : this.favorites()).map(toOption));

  protected opened(open: boolean) {
    if (open && this.reads()) this.catalog.loadProjects();
  }

  protected pick(value: unknown) {
    this.valueChange.emit(typeof value === 'string' ? value.trim().toUpperCase() : '');
  }
}

const toOption = (project: { key: string; name: string }): ProjectOption => ({
  key: project.key,
  name: project.name,
  label: `${project.key} ${project.name}`,
});
