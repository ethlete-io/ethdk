import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ProjectLinkTarget, TimetrackProjectLink } from '@ethlete/timetrack';
import { ProjectSelectComponent } from '../jira';
import { ExplainComponent } from './explain.component';

const WHY = `A directory covers everything under it, and a path named on its own beats the directory it
sits in — so one client checkout can stay work inside a folder you marked private.

Marking a path private is the only statement in the app that takes time out of a day, which is why every
one of them is listed here. The same editor on the same machine writes a client's code and a side
project's, and nothing the collectors see can tell the two apart. A path can.`;

/**
 * Which directories are work, and which are the user's own.
 *
 * Repositories have their own list — see `ethlete-repo-projects`. This is the one below it: the
 * directory roots, and any path the discovery does not report as a repository at all.
 */
@Component({
  selector: 'ethlete-project-links',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Directories</h3>
        <ethlete-explain [text]="WHY" label="directories that are work" />
      </div>

      @for (link of listed(); track link.id) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <et-badge [color]="link.color" size="sm">{{ link.kind }}</et-badge>
          <span class="grow break-all text-mono text-small">{{ link.path }}</span>
          <span class="w-24 shrink-0 text-small">{{ link.target }}</span>

          <button
            [attr.aria-label]="'Forget what ' + link.path + ' counts as'"
            (click)="remove.emit(link.id)"
            et-button
            variant="transparent"
            size="sm"
          >
            Remove
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">
          None yet. Every repository is work, and one nothing can name is offered in the day review.
        </p>
      }

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-label>Path</et-label>
          <et-input [(value)]="path" placeholder="/home/you/dev/side-project" />
        </et-form-field>

        <ethlete-project-select
          [value]="projectKey()"
          (valueChange)="projectKey.set($event)"
          class="w-45"
          ariaLabel="The project this path files its tickets in"
          placeholder="Project"
        />

        <button [disabled]="!canLink()" (click)="link()" et-button variant="outline" size="sm">Link to project</button>

        <button [disabled]="!path().trim()" (click)="markPrivate()" et-button variant="transparent" size="sm">
          Mark private
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, ExplainComponent, FORM_FIELD_IMPORTS, INPUT_IMPORTS, ProjectSelectComponent],
})
export class ProjectLinksComponent {
  public links = input.required<readonly TimetrackProjectLink[]>();

  public add = output<{ path: string; target: ProjectLinkTarget }>();
  public remove = output<string>();

  protected readonly WHY = WHY;

  protected path = signal('');
  protected projectKey = signal('');

  protected canLink = computed(() => !!this.path().trim() && !!this.projectKey().trim());

  protected listed = computed(() =>
    this.links().map((link) => ({
      id: link.id,
      path: link.path,
      kind: link.target.kind === 'private' ? 'private' : 'work',
      target: link.target.kind === 'private' ? 'never logged' : link.target.projectKey,
      color: link.target.kind === 'private' ? 'warning' : 'brand',
    })),
  );

  protected link() {
    this.add.emit({
      path: this.path().trim(),
      target: { kind: 'project', projectKey: this.projectKey().trim().toUpperCase() },
    });
    this.clear();
  }

  protected markPrivate() {
    this.add.emit({ path: this.path().trim(), target: { kind: 'private' } });
    this.clear();
  }

  private clear() {
    this.path.set('');
    this.projectKey.set('');
  }
}
