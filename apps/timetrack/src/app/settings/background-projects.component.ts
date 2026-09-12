import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import { TimetrackFavoriteProject } from '@ethlete/timetrack';
import { ExplainComponent } from './explain.component';

const WHY = `Some work runs behind a day rather than being it: the shared library you sit in all day while
the tickets you book belong to the applications that use it. A band of such a project would claim every
minute of your presence and overlap every other band on the day.

Name the project here and its band keeps only the minutes no other band claims. Nothing is marked by
default, and no rule can work it out: the same repository is the background of one day and the whole of
the work on the next.`;

/**
 * The projects whose bands yield to the rest of the day.
 *
 * It offers the picked projects and nothing else. A key naming a project the user does not work in
 * would cut nothing, and the settings document drops it for the same reason.
 */
@Component({
  selector: 'ethlete-background-projects',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Work that runs in the background</h3>
        <ethlete-explain [text]="WHY" label="background projects" />
      </div>

      <et-form-field appearance="underline" size="sm">
        <et-label>Background projects</et-label>
        <et-select
          [value]="picked()"
          [disabled]="!projects().length"
          (valueChange)="pick($event)"
          placeholder="Pick the projects that yield to the rest of the day"
          multiple
        >
          <input etSelectSearch placeholder="Search your projects" />

          @for (project of projects(); track project.key) {
            <et-select-option [value]="project.key" [label]="project.key + ' ' + project.name">
              <span class="flex min-w-0 items-baseline gap-2">
                <span class="shrink-0 text-mono text-small">{{ project.key }}</span>
                <span class="min-w-0 grow truncate text-small">{{ project.name }}</span>
              </span>
            </et-select-option>
          }
        </et-select>
        <et-hint>{{ hint() }}</et-hint>
      </et-form-field>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ExplainComponent, FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
export class BackgroundProjectsComponent {
  public projects = input.required<readonly TimetrackFavoriteProject[]>();
  public keys = input.required<readonly string[]>();

  /** What the picker chose, whole. The document holds a list, so the list is what is written. */
  public keysChange = output<readonly string[]>();
  protected readonly WHY = WHY;

  protected picked = computed(() => [...this.keys()]);

  protected hint = computed(() =>
    this.projects().length
      ? 'A band of one of these keeps only the time no other band claims.'
      : 'Pick your projects first — a project you do not work in can cut nothing.',
  );

  protected pick(value: unknown) {
    this.keysChange.emit(
      Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [],
    );
  }
}
