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
  ParentCandidate,
  TicketWritingRequest,
  UnnamedContext,
  describeAttributionRule,
  formatDurationMs,
} from '@ethlete/timetrack';
import { ProjectSelectComponent } from '../jira';
import { AgentMatch, TicketForm } from './ticket-draft';

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

        @if (matches().length) {
          <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3">
            <span class="text-small">This work may already have a ticket.</span>

            @for (match of matches(); track match.key) {
              <div class="flex flex-wrap items-center gap-3">
                <span class="flex min-w-50 grow flex-col">
                  <span class="text-small">{{ match.key }} — {{ match.summary }}</span>
                  @if (match.reason) {
                    <span class="text-small text-et-surface-muted">{{ match.reason }}</span>
                  }
                </span>
                <button (click)="useExisting.emit(match.key)" et-button variant="outline" size="sm">
                  Log on {{ match.key }}
                </button>
              </div>
            }
          </div>
        }

        @if (canWrite()) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3">
              <button [disabled]="isWriting()" (click)="write.emit()" et-button variant="outline" size="sm">
                @if (isWriting()) {
                  <et-spinner size="sm" />
                }
                Let the agent fill this in
              </button>
              <span class="text-small text-et-surface-muted">
                It writes the summary and the description, picks the parent, and says if a ticket for this already
                exists. Everything stays yours to edit.
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
          <div class="flex w-60 flex-col gap-1">
            <span class="text-small text-et-surface-muted">Project</span>
            <ethlete-project-select
              [value]="draft.projectKey"
              (valueChange)="projectKeyChange.emit($event)"
              ariaLabel="The project the ticket is filed in"
            />
          </div>

          <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
            <et-label>Summary</et-label>
            <et-input [value]="draft.summary" (valueChange)="summaryChange.emit($event)" />
          </et-form-field>
        </div>

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
          <et-form-field appearance="underline" size="sm">
            <et-label>Parent</et-label>
            <et-select
              [value]="draft.parentKey"
              [loading]="isSearching()"
              (valueChange)="pickParent($event)"
              placeholder="No parent"
            >
              <input etSelectSearch placeholder="Search parents" />

              @for (candidate of candidates(); track candidate.issue.key) {
                <et-select-option
                  [value]="candidate.issue.key"
                  [label]="candidate.issue.key + ' ' + candidate.issue.summary"
                >
                  <span class="flex min-w-0 items-baseline gap-2">
                    <span class="shrink-0 text-mono text-small">{{ candidate.issue.key }}</span>
                    <span class="min-w-0 grow truncate text-small">{{ candidate.issue.summary }}</span>
                    <span class="shrink-0 text-small text-et-surface-subtle">{{ candidate.issue.issueType }}</span>
                  </span>
                </et-select-option>
              }
            </et-select>
          </et-form-field>

          @if (isSearching()) {
            <div class="flex items-center gap-3 text-et-surface-muted">
              <et-spinner size="sm" />
              <span class="text-small">Reading the project's issues…</span>
            </div>
          }

          @if (searchFailure(); as failure) {
            <et-banner [description]="failure" type="warning" heading="The parents could not be read" />
            <button (click)="findParents.emit()" et-button variant="outline" size="sm">Read them again</button>
          }
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
    ProjectSelectComponent,
    SELECT_IMPORTS,
    SpinnerComponent,
    TEXTAREA_IMPORTS,
  ],
})
export class CreateTicketComponent {
  public context = input.required<UnnamedContext>();
  public form = input<TicketForm | null>(null);
  public candidates = input<readonly ParentCandidate[]>([]);
  /** Open issues whose wording says this may already be tracked. */
  public existing = input<readonly ParentCandidate[]>([]);
  /** The issue the agent says is this very work, which outranks anything the wording matched. */
  public agentMatch = input<AgentMatch | null>(null);
  /** Exactly what a writing run would send, shown here so it can be read before it leaves the machine. */
  public payload = input<TicketWritingRequest | null>(null);
  public isSearching = input(false);
  public canWrite = input(false);
  public isWriting = input(false);
  public isCreating = input(false);
  public canCreate = input(false);
  public createdKey = input<string | null>(null);
  public searchFailure = input<string | null>(null);
  public writeFailure = input<string | null>(null);
  public createFailure = input<string | null>(null);

  public projectKeyChange = output<string>();
  public summaryChange = output<string>();
  public descriptionChange = output<string>();
  public parentKeyChange = output<string | null>();
  public findParents = output<void>();
  public write = output<void>();
  /** The key of an issue that already tracks this work, taken instead of filing a new ticket. */
  public useExisting = output<string>();
  public create = output<void>();
  public dismiss = output<void>();

  protected label = computed(() => describeAttributionRule(this.context().suggestion));
  protected duration = computed(() => formatDurationMs(this.context().observedMs));
  protected printedPayload = computed(() => JSON.stringify(this.payload(), null, 2));

  /** The agent's answer first, then what the wording matched, with the same issue never listed twice. */
  protected matches = computed(() => {
    const agent = this.agentMatch();
    const found = agent ? [{ key: agent.issueKey, summary: agent.summary, reason: agent.reason }] : [];
    const matched = this.existing()
      .filter((candidate) => candidate.issue.key !== agent?.issueKey)
      .map((candidate) => ({ key: candidate.issue.key, summary: candidate.issue.summary, reason: '' }));

    return [...found, ...matched];
  });

  protected pickParent(value: unknown) {
    this.parentKeyChange.emit(typeof value === 'string' ? value : null);
  }
}
