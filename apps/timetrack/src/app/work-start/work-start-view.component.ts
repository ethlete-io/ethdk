import { Component, ViewEncapsulation } from '@angular/core';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  EMPTY_STATE_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SELECT_IMPORTS,
  SpinnerComponent,
  TEXTAREA_IMPORTS,
} from '@ethlete/components';
import { ProjectSelectComponent } from '../jira';
import { injectWorkStart } from './work-start';
import { WorkStartPlanComponent } from './work-start-plan.component';

/**
 * Starting a piece of work the right way round: the issue, then the branch the grammar names for it,
 * then the draft merge request it will be reviewed in.
 *
 * The plan re-derives as the form is typed, so the branch name is visible long before anything is
 * filed. This is the same operation as `ethlete-agents git-flow start`, over the same `planStart`.
 */
@Component({
  selector: 'ethlete-work-start',
  template: `
    <div class="flex min-h-0 grow flex-col overflow-y-auto">
      <header class="flex shrink-0 flex-col gap-1 px-6 pt-6 pb-4">
        <h2 class="text-h3">Start work</h2>
        <p class="text-small text-et-surface-muted">
          Files the issue, creates the branch the grammar names for it, and opens a draft merge request.
        </p>
      </header>

      <div class="flex max-w-200 flex-col gap-4 px-6 pb-6">
        @if (start.repos().length) {
          <et-form-field appearance="underline" size="sm">
            <et-label>Repository</et-label>
            <et-select
              [value]="start.form().repoPath || null"
              (valueChange)="pickRepo($event)"
              placeholder="Pick a repository"
            >
              @for (repo of start.repos(); track repo) {
                <et-select-option [value]="repo">{{ repo }}</et-select-option>
              }
            </et-select>
          </et-form-field>
        } @else {
          <et-empty-state
            description="No repository has been discovered yet. Add a directory under Settings, where repositories are looked for."
            heading="Nothing to start work in"
          />
        }

        @if (start.isReading()) {
          <div class="flex items-center gap-3 text-et-surface-muted">
            <et-spinner size="sm" />
            <span class="text-small">Reading the repository…</span>
          </div>
        }

        @if (start.readFailure(); as failure) {
          <et-banner [description]="failure" type="error" heading="The repository could not be read" />
        }

        @if (start.form().repoPath) {
          <div class="flex flex-wrap items-end gap-3">
            <div class="flex w-40 flex-col gap-1">
              <span class="text-small text-et-surface-muted">Project</span>
              <ethlete-project-select
                [value]="start.form().projectKey"
                (valueChange)="start.setProjectKey($event)"
                ariaLabel="The project the ticket is filed in"
                placeholder="Project"
              />
            </div>

            <et-form-field class="w-30" appearance="underline" size="sm">
              <et-label>Type</et-label>
              <et-select [value]="start.form().type" (valueChange)="pickType($event)" clearable="false">
                @for (type of start.types(); track type) {
                  <et-select-option [value]="type">{{ type }}</et-select-option>
                }
              </et-select>
            </et-form-field>

            <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
              <et-label>Summary</et-label>
              <et-input [value]="start.form().summary" (valueChange)="start.setSummary($event)" />
            </et-form-field>
          </div>

          <et-form-field appearance="underline" size="sm">
            <et-label>Description</et-label>
            <et-textarea
              [value]="start.form().description"
              [minRows]="3"
              [maxRows]="10"
              (valueChange)="start.setDescription($event)"
              autosize
            />
          </et-form-field>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="text-small">Parent story</span>
              @if (start.isSearching()) {
                <et-spinner size="sm" />
              }
            </div>

            @if (start.searchFailure(); as failure) {
              <et-banner [description]="failure" type="warning" heading="The parents could not be read" />
            }

            <div class="flex max-h-60 flex-col gap-1 overflow-y-auto">
              <button
                [pressed]="!start.form().parentKey"
                (click)="start.setParentKey(null)"
                et-button
                variant="transparent"
                size="sm"
              >
                No parent — start a story of its own
              </button>

              @for (candidate of start.candidates(); track candidate.issue.key) {
                <button
                  [pressed]="start.form().parentKey === candidate.issue.key"
                  [variant]="start.form().parentKey === candidate.issue.key ? 'filled' : 'transparent'"
                  (click)="start.setParentKey(candidate.issue.key)"
                  et-button
                  size="sm"
                >
                  <span class="flex min-w-0 grow items-baseline gap-2">
                    <span class="shrink-0 text-mono">{{ candidate.issue.key }}</span>
                    <span class="min-w-0 grow truncate text-left">{{ candidate.issue.summary }}</span>
                    <span class="shrink-0 text-et-surface-subtle">{{ candidate.issue.issueType }}</span>
                  </span>
                </button>
              }
            </div>
          </div>

          @if (start.plan(); as plan) {
            <ethlete-work-start-plan
              [plan]="plan"
              [outcome]="start.outcome()"
              [isRunning]="start.isRunning()"
              (run)="start.run()"
              (again)="start.reset()"
            />
          }
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    EMPTY_STATE_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    ProjectSelectComponent,
    SELECT_IMPORTS,
    SpinnerComponent,
    TEXTAREA_IMPORTS,
    WorkStartPlanComponent,
  ],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class WorkStartViewComponent {
  protected start = injectWorkStart();

  protected pickRepo(value: unknown) {
    this.start.setRepoPath(typeof value === 'string' ? value : '');
  }

  protected pickType(value: unknown) {
    if (typeof value === 'string') this.start.setType(value);
  }
}
