import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import {
  ProjectLinkTarget,
  ProjectPathRow,
  TimetrackFavoriteProject,
  TimetrackProjectLink,
  projectPathRows,
} from '@ethlete/timetrack';
import { ProjectSelectComponent } from '../jira';
import { ExplainComponent } from './explain.component';

const WHY = `A path is linked to a project for two reasons. It decides where a ticket filed from the day
review is created, and it is what tells a client's checkout apart from a side project on the same machine —
the same editor and the same window titles otherwise say nothing about which is which.

A directory covers everything under it, and a path named on its own beats the directory it sits in. That is
how one folder can be private while two checkouts inside it stay work.

Marking a path private is the only statement in the app that takes time out of a day. The suggestion reads
the directory's own name against your projects, and it is a suggestion and never a decision: nothing is
written until you press it.`;

export type PathLink = { path: string; target: ProjectLinkTarget };

/**
 * Every path the user answers for, in one table: the repositories the discovery found, and the
 * directories a link names that no repository sits at.
 *
 * These were two lists, and a link written on a repository row appeared in both — once as that
 * repository's project and once as a bare path underneath it, with a Remove button the repository row
 * did not offer.
 */
@Component({
  selector: 'ethlete-project-paths',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">Paths</h3>
        <ethlete-explain [text]="WHY" label="paths and projects" />
      </div>

      <ul class="flex flex-col">
        @for (row of rows(); track row.path) {
          <li
            [attr.data-path]="row.path"
            class="group grid grid-cols-[5rem_minmax(0,1fr)_7rem_13rem_20rem] items-center gap-x-3 rounded-md px-2 text-small hover:bg-et-surface-interaction"
          >
            <span class="text-et-surface-subtle">{{ row.kind }}</span>

            <span [title]="row.path" class="truncate text-mono">{{ row.path }}</span>

            <span class="text-right text-et-surface-subtle">
              @if (row.inherited) {
                <span [title]="'Covered by ' + row.link?.path">inherited</span>
              }
            </span>

            <ethlete-project-select
              [value]="row.projectKey ?? ''"
              [ariaLabel]="'Project for ' + row.path"
              [placeholder]="row.private ? 'private' : 'Not linked'"
              (valueChange)="link(row, $event)"
              class="w-full"
              compact
            />

            <span class="flex gap-1">
              @if (row.suggestion; as suggestion) {
                <button (click)="link(row, suggestion.key)" et-button variant="outline" size="sm">
                  Link to {{ suggestion.key }}
                </button>
              }

              @if (!row.private) {
                <button
                  (click)="markPrivate(row)"
                  class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                  et-button
                  variant="transparent"
                  size="sm"
                >
                  Mark private
                </button>
              }

              @if (forgettable(row); as linkId) {
                <button
                  [attr.aria-label]="'Forget what ' + row.path + ' counts as'"
                  (click)="remove.emit(linkId)"
                  class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                  et-button
                  variant="transparent"
                  size="sm"
                >
                  Remove
                </button>
              }
            </span>
          </li>
        } @empty {
          <li>
            <et-empty-state
              description="Nothing is being watched yet. Add a directory to look under on the Sources tab, or name a path below."
              heading="No paths yet"
            />
          </li>
        }
      </ul>

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

        <button [disabled]="!canAdd()" (click)="add()" et-button variant="outline" size="sm">Link to project</button>

        <button [disabled]="!path().trim()" (click)="addPrivate()" et-button variant="transparent" size="sm">
          Mark private
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    EMPTY_STATE_IMPORTS,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    ProjectSelectComponent,
  ],
})
export class ProjectPathsComponent {
  public repoPaths = input.required<readonly string[]>();
  public links = input.required<readonly TimetrackProjectLink[]>();
  public projects = input.required<readonly TimetrackFavoriteProject[]>();

  public addLink = output<PathLink>();
  public remove = output<string>();

  protected readonly WHY = WHY;

  protected path = signal('');
  protected projectKey = signal('');

  protected rows = computed(() =>
    projectPathRows({ repoPaths: this.repoPaths(), links: this.links(), projects: this.projects() }),
  );

  protected canAdd = computed(() => !!this.path().trim() && !!this.projectKey().trim());

  /** Only a stated directory can be forgotten whole. A repository row loses its answer, not its row. */
  protected forgettable(row: ProjectPathRow) {
    return row.kind === 'folder' ? row.link?.id : undefined;
  }

  /**
   * Writing a link for a path covered by a directory above it is the point of the picker on such a row:
   * it is how one repository inside a linked folder gets an answer of its own.
   */
  protected link(row: ProjectPathRow, projectKey: string) {
    if (!projectKey) return this.unlink(row);

    this.addLink.emit({ path: row.path, target: { kind: 'project', projectKey } });
  }

  protected markPrivate(row: ProjectPathRow) {
    this.addLink.emit({ path: row.path, target: { kind: 'private' } });
  }

  /**
   * Only a link on this path itself can be taken back here. One on a directory above it is a statement
   * about that directory, and removing it from under a row it merely covers would take every other
   * repository in the folder with it.
   */
  public unlink(row: ProjectPathRow) {
    if (row.link && !row.inherited) this.remove.emit(row.link.id);
  }

  protected add() {
    this.addLink.emit({
      path: this.path().trim(),
      target: { kind: 'project', projectKey: this.projectKey().trim().toUpperCase() },
    });
    this.clear();
  }

  protected addPrivate() {
    this.addLink.emit({ path: this.path().trim(), target: { kind: 'private' } });
    this.clear();
  }

  private clear() {
    this.path.set('');
    this.projectKey.set('');
  }
}
