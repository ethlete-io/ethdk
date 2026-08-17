import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS } from '@ethlete/components';
import {
  ProjectLinkTarget,
  RepoProjectRow,
  TimetrackFavoriteProject,
  TimetrackProjectLink,
  repoProjectRows,
} from '@ethlete/timetrack';
import { ProjectSelectComponent } from '../jira';
import { ExplainComponent } from './explain.component';

const WHY = `A repository is linked to a project for two reasons. It decides where a ticket filed from the
day review is created, and it is what tells a client's checkout apart from a side project on the same
machine — the same editor and the same window titles otherwise say nothing about which is which.

A directory you link covers every repository under it, and a repository you link beats the directory it
sits in. That is how one folder can be private while two checkouts inside it stay work.

The suggestion reads the directory's own name against your projects. It is a suggestion and never a
decision: nothing is written until you press it.`;

export type RepoLink = { path: string; target: ProjectLinkTarget };

/**
 * Every watched repository beside the project it is logged into.
 *
 * The mapping used to be a path and a key typed by hand into two text fields, which is a setting nobody
 * fills in twice. The repositories are already known and the projects are already picked, so this is a
 * list with a picker on each row — and a suggestion on the rows the directory name can answer.
 */
@Component({
  selector: 'ethlete-repo-projects',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-1">
        <h3 class="text-h4">What each repository is logged into</h3>
        <ethlete-explain [text]="WHY" label="repositories and projects" />
      </div>

      @for (row of rows(); track row.repoPath) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="flex min-w-50 grow flex-col">
            <span class="text-small">{{ row.label }}</span>
            <span class="break-all text-mono text-small text-et-surface-subtle">{{ row.repoPath }}</span>
          </span>

          @if (row.private) {
            <et-badge color="warning" size="sm">private</et-badge>
          } @else if (row.inherited) {
            <et-badge size="sm">from {{ row.link?.path }}</et-badge>
          }

          @if (row.suggestion; as suggestion) {
            <button (click)="link(row, suggestion.key)" et-button variant="outline" size="sm">
              Link to {{ suggestion.key }}
            </button>
          }

          <ethlete-project-select
            [value]="row.projectKey ?? ''"
            [ariaLabel]="'Project for ' + row.label"
            [placeholder]="row.private ? 'Never logged' : 'Not linked'"
            (valueChange)="link(row, $event)"
            class="w-50"
          />

          @if (row.private) {
            <button (click)="unlink(row)" et-button variant="transparent" size="sm">Make it work again</button>
          } @else {
            <button (click)="markPrivate(row)" et-button variant="transparent" size="sm">Mark private</button>
          }
        </div>
      } @empty {
        <et-empty-state
          description="Nothing is being watched yet. Add a directory to look under, on the Sources tab."
          heading="No repositories found"
        />
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, ExplainComponent, ProjectSelectComponent],
})
export class RepoProjectsComponent {
  public repoPaths = input.required<readonly string[]>();
  public links = input.required<readonly TimetrackProjectLink[]>();
  public projects = input.required<readonly TimetrackFavoriteProject[]>();

  public add = output<RepoLink>();
  public remove = output<string>();

  protected readonly WHY = WHY;

  protected rows = computed(() =>
    repoProjectRows({ repoPaths: this.repoPaths(), links: this.links(), projects: this.projects() }),
  );

  /**
   * Writing a link for a repository covered by a directory above it is the point of the picker on such a
   * row: it is how one repository inside a linked folder gets an answer of its own.
   */
  protected link(row: RepoProjectRow, projectKey: string) {
    if (!projectKey) return this.unlink(row);

    this.add.emit({ path: row.repoPath, target: { kind: 'project', projectKey } });
  }

  protected markPrivate(row: RepoProjectRow) {
    this.add.emit({ path: row.repoPath, target: { kind: 'private' } });
  }

  /**
   * Only a link on this repository itself can be taken back here. One on a directory above it is a
   * statement about that directory, and removing it from under a row it merely covers would take every
   * other repository in the folder with it.
   */
  protected unlink(row: RepoProjectRow) {
    if (row.link && !row.inherited) this.remove.emit(row.link.id);
  }
}
