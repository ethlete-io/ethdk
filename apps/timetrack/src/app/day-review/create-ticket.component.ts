import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
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
  JiraIssue,
  ParentCandidate,
  ParentWritingRequest,
  SpecHeader,
  StandIn,
  TicketWritingRequest,
  UnnamedContext,
  describeAttributionRule,
  formatDurationMs,
} from '@ethlete/timetrack';
import { ProjectSelectComponent } from '../jira';
import { AgentMatch, ParentForm, TicketForm } from './ticket-draft';
import { UnmaskedWordsComponent } from './unmasked-words.component';

/**
 * The create form for work no issue covers. It writes to Jira, so it shows the whole ticket before it
 * is sent and keeps every field editable: a wrong row can be edited away, a wrong ticket cannot.
 */
@Component({
  selector: 'ethlete-create-ticket',
  template: `
    <div class="flex flex-col gap-3 rounded-md border border-et-brand-ink p-3">
      <div class="flex flex-wrap items-baseline gap-3">
        <h4 class="grow text-h4">{{ heading() }}</h4>
        <span class="text-small text-et-surface-muted">{{ duration() }}</span>
        <button (click)="dismiss.emit()" et-button variant="transparent" size="sm">Close</button>
      </div>

      @if (createdKey(); as key) {
        <div class="flex flex-col gap-2 rounded-md border border-et-brand-ink p-3">
          <span class="text-h4">Filed {{ key }}</span>

          @if (createdParent(); as parent) {
            <span class="text-small">
              {{ parent.issueType }} {{ parent.key }} — {{ parent.summary }}, filed here as its parent.
            </span>
          }

          <span class="text-small text-et-surface-muted">{{ filedNote() }}</span>

          @if (startStatusNote(); as note) {
            <span class="text-small text-et-warn">{{ note }}</span>
          }

          <div>
            <button (click)="dismiss.emit()" et-button variant="filled" size="sm">Back to the day</button>
          </div>
        </div>
      } @else if (duplicateKey(); as key) {
        <et-banner
          [description]="
            key +
            ' already carried this summary, so nothing new was filed. It now holds this work, here and on every later day this context appears in.'
          "
          type="info"
          heading="Jira already had it"
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

        @if (canWrite()) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3">
              <button [disabled]="isWriting()" (click)="write.emit()" et-button variant="outline" size="sm">
                @if (isWriting()) {
                  <et-spinner size="sm" />
                }
                Ask AI
              </button>
              @if (canMatch()) {
                <button [disabled]="isMatching()" (click)="match.emit()" et-button variant="outline" size="sm">
                  @if (isMatching()) {
                    <et-spinner size="sm" />
                  }
                  Ask AI to find a match
                </button>
              }
              <span class="text-small text-et-surface-muted">{{ askNote() }}</span>
            </div>

            @if (writeFailure(); as failure) {
              <et-banner [description]="failure" type="warning" heading="The agent wrote nothing" />
            }

            @if (matchFailure(); as failure) {
              <et-banner [description]="failure" type="warning" heading="The agent found nothing" />
            }

            @if (payload()) {
              <ethlete-unmasked-words [text]="printedPayload()" />

              <details class="rounded-md border border-et-surface-border p-3">
                <summary class="cursor-pointer text-small text-et-surface-muted">
                  What gets sent — {{ sentSummary() }}, no path and no window title
                </summary>
                <pre class="mt-2 overflow-x-auto text-mono text-small">{{ printedPayload() }}</pre>
              </details>
            }
          </div>
        }

        <div class="flex flex-col gap-2">
          <et-form-field class="grow" appearance="underline" size="sm">
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

          @if (parentRule(); as rule) {
            <span class="text-small text-et-surface-muted">{{ rule }}</span>
          }

          @if (spec()?.epicKey; as epicKey) {
            <span class="text-small text-et-surface-muted">The spec names {{ epicKey }}.</span>
          }

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

          @if (parentForm(); as parent) {
            <div class="flex flex-col gap-3 rounded-md border border-et-surface-border p-3">
              <div class="flex flex-wrap items-end gap-3">
                <et-form-field class="min-w-40" appearance="underline" size="sm">
                  <et-label>Level</et-label>
                  <et-select
                    [value]="parent.issueTypeName"
                    (valueChange)="pickParentType($event)"
                    aria-label="The level the parent is filed at"
                  >
                    @for (name of parentTypeNames(); track name) {
                      <et-select-option [value]="name" [label]="name">{{ name }}</et-select-option>
                    }
                  </et-select>
                </et-form-field>

                <et-form-field class="min-w-60 grow" appearance="underline" size="sm">
                  <et-label>Summary</et-label>
                  <et-input [value]="parent.summary" (valueChange)="parentSummaryChange.emit($event)" />
                </et-form-field>
              </div>

              <et-form-field appearance="underline" size="sm">
                <et-label>Description</et-label>
                <et-textarea
                  [value]="parent.description"
                  [minRows]="2"
                  [maxRows]="8"
                  (valueChange)="parentDescriptionChange.emit($event)"
                  autosize
                />
              </et-form-field>

              @if (canWrite()) {
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    [disabled]="isWritingParent()"
                    (click)="writeParent.emit()"
                    et-button
                    variant="outline"
                    size="sm"
                  >
                    @if (isWritingParent()) {
                      <et-spinner size="sm" />
                    }
                    Ask AI
                  </button>
                  <span class="text-small text-et-surface-muted">
                    It writes the wider goal this ticket rolls up to, from the same evidence. Everything stays yours to
                    edit.
                  </span>
                </div>

                @if (parentWriteFailure(); as failure) {
                  <et-banner [description]="failure" type="warning" heading="The agent wrote nothing" />
                }

                @if (parentPayload()) {
                  <ethlete-unmasked-words [text]="printedParentPayload()" />

                  <details class="rounded-md border border-et-surface-border p-3">
                    <summary class="cursor-pointer text-small text-et-surface-muted">
                      What gets sent — the ticket below, and the same notes
                    </summary>
                    <pre class="mt-2 overflow-x-auto text-mono text-small">{{ printedParentPayload() }}</pre>
                  </details>
                }
              }

              @if (createParentFailure(); as failure) {
                <et-banner [description]="failure" type="warning" heading="The parent could not be filed" />
              }

              <div class="flex items-center gap-3">
                <button
                  [disabled]="!canCreateParent() || isCreatingParent()"
                  (click)="createParent.emit()"
                  et-button
                  variant="filled"
                  size="sm"
                >
                  @if (isCreatingParent()) {
                    <et-spinner size="sm" />
                  }
                  File the {{ parent.issueTypeName || 'parent' }}
                </button>

                <button (click)="closeParentForm.emit()" et-button variant="transparent" size="sm">Cancel</button>

                <span class="text-small text-et-surface-muted">It is filed with no parent of its own.</span>
              </div>
            </div>
          } @else if (parentTypeNames().length) {
            <div>
              <button
                [disabled]="!draft.projectKey"
                (click)="openParentForm.emit()"
                et-button
                variant="outline"
                size="sm"
              >
                New parent
              </button>
            </div>
          }
        </div>

        @if (createGate(); as reason) {
          <et-banner [description]="reason" type="warning" heading="Jira does not permit this create" />
        }

        <div class="flex flex-wrap items-center gap-3">
          <button
            [disabled]="!canCreate() || isCreating()"
            (click)="pressCreate()"
            et-button
            variant="filled"
            size="sm"
          >
            @if (isCreating()) {
              <et-spinner size="sm" />
            }
            {{ isArmed() ? 'File it now' : 'Create in Jira' }}
          </button>

          @if (isArmed()) {
            <button (click)="disarm()" et-button variant="transparent" size="sm">Cancel</button>
          }

          <span class="text-small text-et-surface-muted">{{ isArmed() ? ARMED_NOTE : createNote() }}</span>
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
    UnmaskedWordsComponent,
  ],
})
export class CreateTicketComponent {
  /** The unnamed context being filed. Absent when the form was opened on a placeholder instead. */
  public context = input<UnnamedContext | null>(null);
  /** The placeholder being filed, whose days the created key resolves. Exclusive with `context`. */
  public standIn = input<StandIn | null>(null);
  /** The parent this form filed on the way, so the result says what it created and not only the key. */
  public createdParent = input<JiraIssue | null>(null);
  public form = input<TicketForm | null>(null);
  public candidates = input<readonly ParentCandidate[]>([]);
  /** Open issues whose wording says this may already be tracked. */
  public existing = input<readonly ParentCandidate[]>([]);
  /** The issue the agent says is this very work, which outranks anything the wording matched. */
  public agentMatch = input<AgentMatch | null>(null);
  /** Exactly what a writing run would send, shown here so it can be read before it leaves the machine. */
  public payload = input<TicketWritingRequest | null>(null);
  /** The specification the work sits under, unmasked, so the form can name the epic it already gives. */
  public spec = input<SpecHeader | null>(null);
  public isSearching = input(false);
  /** The open new-parent form, or nothing while it is closed. */
  public parentForm = input<ParentForm | null>(null);
  /** The levels a parent may be filed at, from the instance's own hierarchy. */
  public parentTypeNames = input<readonly string[]>([]);
  /** Why the parent list holds fewer types than settings name, said once under the field. */
  public parentRule = input<string | null>(null);
  public canCreateParent = input(false);
  public isCreatingParent = input(false);
  public createParentFailure = input<string | null>(null);
  public canWrite = input(false);
  public canMatch = input(false);
  public isWriting = input(false);
  public isMatching = input(false);
  public isWritingParent = input(false);
  /** Exactly what a parent-writing run would send, shown before it leaves the machine. */
  public parentPayload = input<ParentWritingRequest | null>(null);
  public parentWriteFailure = input<string | null>(null);
  public isCreating = input(false);
  public canCreate = input(false);
  public createdKey = input<string | null>(null);
  /** Why this project holds no create, from Jira's own permissions. `null` while it holds one. */
  public createGate = input<string | null>(null);
  /** The key the press landed on because Jira already held it. See `createdKey` for a new one. */
  public duplicateKey = input<string | null>(null);

  /** Why the filed ticket does not stand in the status the settings name, or nothing when it does. */
  public startStatusNote = input<string | null>(null);
  public searchFailure = input<string | null>(null);
  public writeFailure = input<string | null>(null);
  public matchFailure = input<string | null>(null);
  public createFailure = input<string | null>(null);

  public projectKeyChange = output<string>();
  public summaryChange = output<string>();
  public descriptionChange = output<string>();
  public parentKeyChange = output<string | null>();
  public findParents = output<void>();
  public openParentForm = output<void>();
  public closeParentForm = output<void>();
  public parentSummaryChange = output<string>();
  public parentDescriptionChange = output<string>();
  public parentIssueTypeNameChange = output<string>();
  public createParent = output<void>();
  public write = output<void>();
  /** Asks the agent for the wider goal the ticket rolls up to, into the open parent form. */
  public writeParent = output<void>();
  /** The key of an issue that already tracks this work, taken instead of filing a new ticket. */
  public match = output<void>();
  public useExisting = output<string>();
  public create = output<void>();
  public dismiss = output<void>();

  protected duration = computed(() => {
    const context = this.context();

    if (context) return formatDurationMs(context.observedMs);

    const days = this.standIn()?.days.length ?? 0;

    return days ? `${days} day${days === 1 ? '' : 's'} waiting` : '';
  });

  protected askNote = computed(() =>
    this.canMatch()
      ? 'The first press rewrites the summary and the description. The second only looks for the parent and for a ticket that may already be this work, and leaves your words alone.'
      : 'It writes the summary and the description, picks the parent, and says if a ticket for this already exists. Everything stays yours to edit.',
  );

  /** What the placeholder is called, for a heading that reads as the work rather than as a checkout. */
  public name = computed(() => this.standIn()?.name ?? 'work with no ticket');

  protected heading = computed(() => {
    const context = this.context();

    return context ? `New ticket for ${describeAttributionRule(context.suggestion)}` : `A ticket for ${this.name()}`;
  });

  protected createNote = computed(() =>
    this.standIn()
      ? 'Filing it resolves the placeholder, so every day it holds books against the new key.'
      : 'Filing it also logs this work against the new key from now on.',
  );

  protected filedNote = computed(() => {
    const waiting = this.standIn();

    if (!waiting) return 'It now holds this work, here and on every later day this context appears in.';

    const days = waiting.days.length;

    return `${this.name()} is no longer waiting. Every band of it books against the key, on ${days} day${days === 1 ? '' : 's'} and on every later one.`;
  });
  protected printedPayload = computed(() => JSON.stringify(this.payload(), null, 2));
  protected printedParentPayload = computed(() => JSON.stringify(this.parentPayload(), null, 2));

  protected sentSummary = computed(() => {
    const request = this.payload();
    const notes = request?.notes.length ?? 0;
    const work = request?.standIn ? 'your own name for the work' : `${notes} note(s)`;

    return request?.spec ? `${work} and the spec it sits under` : work;
  });

  /** The agent's answer first, then what the wording matched, with the same issue never listed twice. */
  protected matches = computed(() => {
    const agent = this.agentMatch();
    const found = agent ? [{ key: agent.issueKey, summary: agent.summary, reason: agent.reason }] : [];
    const matched = this.existing()
      .filter((candidate) => candidate.issue.key !== agent?.issueKey)
      .map((candidate) => ({ key: candidate.issue.key, summary: candidate.issue.summary, reason: '' }));

    return [...found, ...matched];
  });

  protected readonly ARMED_NOTE = 'Jira holds no delete, so a filed ticket stays whatever happens next.';

  protected isArmed = signal(false);

  protected pressCreate() {
    if (!this.isArmed()) {
      this.isArmed.set(true);

      return;
    }

    this.isArmed.set(false);
    this.create.emit();
  }

  protected disarm() {
    this.isArmed.set(false);
  }

  protected pickParent(value: unknown) {
    this.parentKeyChange.emit(typeof value === 'string' ? value : null);
  }

  protected pickParentType(value: unknown) {
    if (typeof value === 'string') this.parentIssueTypeNameChange.emit(value);
  }
}
