import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { ProjectLinkTarget, TimetrackProjectLink } from '@ethlete/timetrack';

/**
 * Which paths are work, and which are the user's own.
 *
 * The same editor on the same machine writes a client's code and a side project's, so nothing the
 * collectors see can tell the two apart. A path can. Marking one private is also the only statement in
 * the app that takes time out of a day, which is why the list shows every one of them.
 */
@Component({
  selector: 'ethlete-project-links',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-h4">What counts as work</h3>
        <p class="text-small text-et-surface-muted">
          A directory covers everything under it. A path named on its own beats the directory it sits in, so one client
          checkout can stay work inside a private folder.
        </p>
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

        <et-form-field class="w-32" appearance="underline" size="sm">
          <et-label>Project</et-label>
          <et-input [(value)]="projectKey" placeholder="FIP" />
        </et-form-field>

        <button [disabled]="!canLink()" (click)="link()" et-button variant="outline" size="sm">Link to project</button>

        <button [disabled]="!path().trim()" (click)="markPrivate()" et-button variant="transparent" size="sm">
          Mark private
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class ProjectLinksComponent {
  public links = input.required<readonly TimetrackProjectLink[]>();

  public add = output<{ path: string; target: ProjectLinkTarget }>();
  public remove = output<string>();

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
