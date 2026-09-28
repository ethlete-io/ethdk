import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, FORM_FIELD_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { StandIn, formatDurationMs, standInWhere } from '@ethlete/timetrack';
import { CreateTicketComponent } from '../day-review/create-ticket.component';
import { formatDayRangeLabel, formatWeekdayLabel } from '../day-review/format';
import { injectTicketDraft } from '../day-review/ticket-draft';
import { IssueSelectComponent } from '../jira';
import { injectStandIns } from './stand-ins';

/**
 * What the user named before Jira held a ticket for it, and the three ways one ends.
 *
 * A stand-in books nothing, so a list that is never read is a day of work that never reaches Tempo.
 * Resolving one names the issue the work turned out to be and every band on every day it held takes
 * that key; deleting one puts those bands back to unnamed.
 *
 * It carries no chrome of its own, so it reads the same inside the Debug accordion and inside the
 * overlay the edit surface opens. Two dialogs must never stack: one on top of the other keeps
 * re-measuring, and the panel then moves under the pointer.
 *
 * Give it `only` to show one placeholder. A user who pressed a band asked about that band, and a
 * list of every other one is a management screen they did not ask for.
 */
@Component({
  selector: 'ethlete-stand-ins-list',
  template: `
    @if (listed().length) {
      <div class="flex flex-col gap-3">
        @for (entry of listed(); track entry.id) {
          <div
            [attr.data-stand-in]="entry.id"
            [attr.data-state]="entry.standIn.state"
            [class.rounded-md]="!only()"
            [class.border]="!only()"
            [class.p-3]="!only()"
            class="flex flex-col gap-4 border-et-surface-border"
          >
            <div class="flex min-w-0 flex-col gap-1">
              @if (!only()) {
                <span class="text-h4">{{ entry.standIn.name }}</span>
              }

              <div class="flex flex-wrap items-center gap-2 text-small text-et-surface-muted">
                <span>{{ entry.meta }}</span>

                @if (entry.isOverdue) {
                  <span class="rounded-sm bg-et-warning/15 px-2 text-et-warning-ink" data-overdue>
                    Waited long enough
                  </span>
                }
              </div>

              @if (entry.where) {
                <div [title]="entry.where" class="truncate text-mono text-small text-et-surface-subtle">
                  {{ entry.where }}
                </div>
              }
            </div>

            @if (entry.standIn.state === 'open') {
              <div class="flex flex-wrap items-center gap-2">
                <et-form-field class="min-w-60 grow">
                  <ethlete-issue-select
                    [projectKey]="entry.projectKey"
                    [ariaLabel]="'Issue for ' + entry.standIn.name"
                    (valueChange)="resolve(entry.id, $event)"
                    value=""
                    placeholder="Jira has it already? Pick the issue"
                  />
                </et-form-field>

                @if (tickets.standIn()?.id !== entry.id) {
                  <button (click)="tickets.openForStandIn(entry.standIn)" et-button variant="outline">
                    File a ticket
                  </button>
                }

                @if (entry.standIn.resolutionSource === 'human') {
                  <button (click)="store.handBack(entry.id)" et-text-button>Hand back to auto mode</button>
                }

                @if (!only()) {
                  <button (click)="store.remove(entry.id)" et-text-button etProvideColor="danger">Delete</button>
                }
              </div>
            } @else {
              <div class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 grow text-small">
                  Resolved to <span class="text-mono">{{ entry.standIn.issueKey }}</span>
                  @if (entry.standIn.resolutionSource === 'auto') {
                    by auto mode
                  }
                </span>

                @if (entry.canReopen) {
                  <button (click)="store.reopen(entry.id)" et-button variant="outline">Undo</button>
                } @else {
                  <span class="text-small text-et-surface-muted">
                    A day it held is in Tempo, so the key is a correction from there on.
                  </span>
                }

                <button (click)="store.remove(entry.id)" et-button variant="outline" etProvideColor="danger">
                  Delete
                </button>
              </div>
            }

            @if (tickets.standIn()?.id === entry.id) {
              <ethlete-create-ticket
                [class.border-t]="!!only()"
                [class.pt-4]="!!only()"
                [embedded]="!!only()"
                [standIn]="tickets.standIn()"
                [createdParent]="tickets.createdParent()"
                [form]="tickets.form()"
                [candidates]="tickets.candidates()"
                [existing]="tickets.existing()"
                [agentMatch]="tickets.agentMatch()"
                [payload]="tickets.writingRequest()"
                [spec]="tickets.spec()"
                [isSearching]="tickets.isSearching()"
                [parentForm]="tickets.parentForm()"
                [parentTypeNames]="tickets.parentTypeNames()"
                [parentRule]="tickets.parentRule()"
                [canCreateParent]="tickets.canCreateParent()"
                [isCreatingParent]="tickets.isCreatingParent()"
                [createParentFailure]="tickets.createParentFailure()"
                [canWrite]="tickets.canWrite()"
                [canMatch]="tickets.canMatch()"
                [isWriting]="tickets.isWriting()"
                [isMatching]="tickets.isMatching()"
                [isWritingParent]="tickets.isWritingParent()"
                [parentPayload]="tickets.parentWritingRequest()"
                [parentWriteFailure]="tickets.parentWriteFailure()"
                [isCreating]="tickets.isCreating()"
                [canCreate]="tickets.canCreate()"
                [createGate]="tickets.createGate()"
                [createdKey]="tickets.createdKey()"
                [duplicateKey]="tickets.duplicateKey()"
                [startStatusNote]="tickets.startStatusNote()"
                [parentLinkNote]="tickets.parentLinkNote()"
                [searchFailure]="tickets.searchFailure()"
                [writeFailure]="tickets.writeFailure()"
                [matchFailure]="tickets.matchFailure()"
                [createFailure]="tickets.createFailure()"
                (projectKeyChange)="tickets.setProjectKey($event)"
                (summaryChange)="tickets.setSummary($event)"
                (descriptionChange)="tickets.setDescription($event)"
                (parentKeyChange)="tickets.setParentKey($event)"
                (findParents)="tickets.findParents()"
                (openParentForm)="tickets.openParentForm()"
                (closeParentForm)="tickets.closeParentForm()"
                (parentSummaryChange)="tickets.setParentSummary($event)"
                (parentDescriptionChange)="tickets.setParentDescription($event)"
                (parentIssueTypeNameChange)="tickets.setParentIssueTypeName($event)"
                (createParent)="tickets.createParent()"
                (write)="tickets.writeWithAgent()"
                (match)="tickets.matchWithAgent()"
                (writeParent)="tickets.writeParentWithAgent()"
                (useExisting)="tickets.useExisting($event)"
                (create)="tickets.create()"
                (dismiss)="tickets.close()"
                class="block border-et-surface-border"
              />
            }
          </div>
        }
      </div>
    } @else {
      <et-empty-state
        description="Name work here from the day screen, whenever it starts before Jira holds a ticket for it."
        heading="Nothing waits on a ticket"
      />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CreateTicketComponent,
    EMPTY_STATE_IMPORTS,
    FORM_FIELD_IMPORTS,
    IssueSelectComponent,
    ProvideColorDirective,
  ],
  host: { class: 'contents' },
})
export class StandInsListComponent {
  protected store = injectStandIns();
  protected tickets = injectTicketDraft();

  /** The one placeholder to show, by id. Null lists every one of them. */
  public only = input<string | null>(null);

  protected listed = computed(() => {
    const ages = this.store.ages();
    const only = this.only();

    return this.store
      .standIns()
      .filter((standIn) => !only || standIn.id === only)
      .map((standIn) => {
        const age = ages.get(standIn.id);

        return {
          id: standIn.id,
          standIn,
          projectKey: standIn.projectKey ?? '',
          meta: [standIn.projectKey, age?.heldMs ? `${formatDurationMs(age.heldMs)} held` : '', daysLabel(standIn)]
            .filter(Boolean)
            .join(' · '),
          where: standInWhere(standIn),
          isOverdue: !!age?.isOverdue,
          canReopen: this.store.canReopen(standIn),
        };
      });
  });

  protected resolve(id: string, issueKey: string) {
    if (issueKey) this.store.resolve({ id, issueKey });
  }
}

/** The days a stand-in holds bands on, which are the days a resolve makes bookable. */
const daysLabel = (standIn: StandIn) => {
  const count = standIn.days.length;

  if (!count) return 'no day yet';

  const first = standIn.days[0] as string;

  return count === 1
    ? `on ${formatWeekdayLabel(first)}`
    : `${count} days, ${formatDayRangeLabel(first, standIn.days[count - 1] as string)}`;
};
