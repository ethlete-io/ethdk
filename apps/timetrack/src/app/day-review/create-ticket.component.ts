import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SELECT_IMPORTS,
  SpinnerComponent,
  TEXTAREA_IMPORTS,
} from '@ethlete/components';
import {
  JiraProject,
  ParentCandidate,
  TicketWritingRequest,
  UnnamedContext,
  describeAttributionRule,
  formatDurationMs,
} from '@ethlete/timetrack';
import { TicketForm } from './ticket-draft';

/**
 * The create form for work no issue covers. It writes to Jira, so it shows the whole ticket before it
 * is sent and keeps every field editable: a wrong row can be edited away, a wrong ticket cannot.
 */
@Component({
  selector: 'ethlete-create-ticket',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-brand-ink p-3">
      <div class="flex flex-wrap items-baseline gap-3">
        <h4 class="grow text-h4">New ticket for {{ label() }}</h4>
        <span class="text-small text-et-surface-muted">{{ duration() }}</span>
        <button (click)="dismiss.emit()" et-button variant="transparent" size="sm">Close</button>
      </div>

      @if (createdKey(); as key) {
        <et-banner
          [description]="key + ' now holds this work, here and on every later day this context appears in.'"
          type="success"
          heading="Filed"
        />
      } @else if (form(); as draft) {
        @if (createFailure(); as failure) {
          <et-banner [description]="failure" type="error" heading="Jira did not take the ticket" />
        }

        @if (canWrite()) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3">
              <button [disabled]="isWriting()" (click)="write.emit()" et-button variant="outline" size="sm">
                @if (isWriting()) {
                  <et-spinner size="sm" />
                }
                Let the agent write it
              </button>
              <span class="text-small text-et-surface-muted">
                It rewrites the summary and the description. Both stay yours to edit.
              </span>
            </div>

            @if (writeFailure(); as failure) {
              <et-banner [description]="failure" type="warning" heading="The agent wrote nothing" />
            }

            @if (payload(); as request) {
              <details class="rounded-md border border-et-surface-border p-3">
                <summary class="cursor-pointer text-small text-et-surface-muted">
                  What gets sent — {{ request.notes.length }} note(s), no path and no window title
                </summary>
                <pre class="mt-2 overflow-x-auto text-mono text-small">{{ printedPayload() }}</pre>
              </details>
            }
          </div>
        }

        <div class="flex flex-wrap items-end gap-3">
          <et-form-field class="w-70" appearance="underline" size="sm">
            <et-label>Project</et-label>
            @if (projects().length) {
              <et-select
                [value]="draft.projectKey || null"
                (valueChange)="pickProject($event)"
                placeholder="Pick a project"
              >
                @for (project of projects(); track project.key) {
                  <et-select-option [value]="project.key">{{ project.key }} — {{ project.name }}</et-select-option>
                }
              </et-select>
            } @else {
              <et-input
                [value]="draft.projectKey"
                [placeholder]="isLoadingProjects() ? 'Reading the projects…' : 'Type a project key'"
                (valueChange)="projectKeyChange.emit($event)"
              />
            }
          </et-form-field>

          <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
            <et-label>Summary</et-label>
            <et-input [value]="draft.summary" (valueChange)="summaryChange.emit($event)" />
          </et-form-field>
        </div>

        @if (projectFailure(); as failure) {
          <et-banner [description]="failure" type="warning" heading="The projects could not be read" />
          <button (click)="reloadProjects.emit()" et-button variant="outline" size="sm">Read them again</button>
        }

        <et-form-field appearance="underline" size="sm">
          <et-label>Description</et-label>
          <et-textarea
            [value]="draft.description"
            [minRows]="3"
            [maxRows]="10"
            (valueChange)="descriptionChange.emit($event)"
            autosize
          />
        </et-form-field>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-3">
            <span class="text-small">Parent</span>
            @if (isSearching()) {
              <et-spinner size="sm" />
            }
          </div>

          @if (searchFailure(); as failure) {
            <et-banner [description]="failure" type="warning" heading="The parents could not be read" />
            <button (click)="findParents.emit()" et-button variant="outline" size="sm">Read them again</button>
          }

          <div class="flex max-h-60 flex-col gap-1 overflow-y-auto">
            <button
              [pressed]="!draft.parentKey"
              (click)="parentKeyChange.emit(null)"
              et-button
              variant="transparent"
              size="sm"
            >
              No parent
            </button>

            @for (candidate of candidates(); track candidate.issue.key) {
              <button
                [pressed]="draft.parentKey === candidate.issue.key"
                [variant]="draft.parentKey === candidate.issue.key ? 'filled' : 'transparent'"
                (click)="parentKeyChange.emit(candidate.issue.key)"
                et-button
                size="sm"
              >
                {{ candidate.issue.key }} — {{ candidate.issue.summary }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            [disabled]="!canCreate() || isCreating()"
            (click)="create.emit()"
            et-button
            variant="filled"
            size="sm"
          >
            @if (isCreating()) {
              <et-spinner size="sm" />
            }
            Create in Jira
          </button>

          <span class="text-small text-et-surface-muted">
            Filing it also logs this work against the new key from now on.
          </span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    SELECT_IMPORTS,
    SpinnerComponent,
    TEXTAREA_IMPORTS,
  ],
})
export class CreateTicketComponent {
  public context = input.required<UnnamedContext>();
  public form = input<TicketForm | null>(null);
  public candidates = input<readonly ParentCandidate[]>([]);
  /** The projects the instance offers. Empty falls the field back to a typed key. */
  public projects = input<readonly JiraProject[]>([]);
  /** Exactly what a writing run would send, shown here so it can be read before it leaves the machine. */
  public payload = input<TicketWritingRequest | null>(null);
  public isSearching = input(false);
  public isLoadingProjects = input(false);
  public canWrite = input(false);
  public isWriting = input(false);
  public isCreating = input(false);
  public canCreate = input(false);
  public createdKey = input<string | null>(null);
  public searchFailure = input<string | null>(null);
  public projectFailure = input<string | null>(null);
  public writeFailure = input<string | null>(null);
  public createFailure = input<string | null>(null);

  public projectKeyChange = output<string>();
  public summaryChange = output<string>();
  public descriptionChange = output<string>();
  public parentKeyChange = output<string | null>();
  public findParents = output<void>();
  public reloadProjects = output<void>();
  public write = output<void>();
  public create = output<void>();
  public dismiss = output<void>();

  protected label = computed(() => describeAttributionRule(this.context().suggestion));
  protected duration = computed(() => formatDurationMs(this.context().observedMs));
  protected printedPayload = computed(() => JSON.stringify(this.payload(), null, 2));

  protected pickProject(value: unknown) {
    this.projectKeyChange.emit(typeof value === 'string' ? value : '');
  }
}
