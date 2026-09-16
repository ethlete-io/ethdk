import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { BUTTON_IMPORTS, EMPTY_STATE_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { StandIn, StandInAge, formatDurationMs } from '@ethlete/timetrack';
import { CreateTicketComponent } from '../day-review/create-ticket.component';
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
            class="flex flex-col gap-3 rounded-md border border-et-surface-border p-3"
          >
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="min-w-0 grow text-base">{{ entry.standIn.name }}</span>
              @if (entry.projectKey) {
                <span class="shrink-0 text-mono text-small text-et-surface-muted">{{ entry.projectKey }}</span>
              }
              <span class="shrink-0 text-small text-et-surface-muted">{{ entry.days }}</span>
            </div>

            @if (entry.age; as age) {
              <div class="flex flex-wrap items-center gap-2 text-small">
                <span class="text-et-surface-muted">{{ age }}</span>

                @if (entry.isOverdue) {
                  <span class="rounded-sm bg-et-warning/15 px-2 text-et-warning-ink" data-overdue>
                    Waited long enough
                  </span>
                }
              </div>
            }

            @if (entry.standIn.state === 'open') {
              <div class="flex flex-wrap items-center gap-2">
                <ethlete-issue-select
                  [value]="draftFor(entry.id)"
                  [projectKey]="entry.projectKey"
                  [ariaLabel]="'Issue for ' + entry.standIn.name"
                  (valueChange)="setDraft(entry.id, $event)"
                  class="w-42 shrink-0"
                  placeholder="Issue"
                />

                <button [disabled]="!draftFor(entry.id)" (click)="resolve(entry.id)" et-button size="sm">
                  Resolve
                </button>

                <button (click)="tickets.openForStandIn(entry.standIn)" et-button variant="outline" size="sm">
                  File a ticket
                </button>

                <button (click)="store.remove(entry.id)" et-button variant="outline" size="sm" etProvideColor="danger">
                  Delete
                </button>
              </div>
            } @else {
              <div class="flex flex-wrap items-center gap-2">
                <span class="min-w-0 grow text-small">
                  Resolved to <span class="text-mono">{{ entry.standIn.issueKey }}</span>
                </span>

                @if (entry.canReopen) {
                  <button (click)="store.reopen(entry.id)" et-button variant="outline" size="sm">Undo</button>
                } @else {
                  <span class="text-small text-et-surface-muted">
                    A day it held is in Tempo, so the key is a correction from there on.
                  </span>
                }

                <button (click)="store.remove(entry.id)" et-button variant="outline" size="sm" etProvideColor="danger">
                  Delete
                </button>
              </div>
            }

            @if (tickets.standIn()?.id === entry.id) {
              <ethlete-create-ticket
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
  imports: [BUTTON_IMPORTS, CreateTicketComponent, EMPTY_STATE_IMPORTS, IssueSelectComponent, ProvideColorDirective],
  host: { class: 'contents' },
})
export class StandInsListComponent {
  protected store = injectStandIns();
  protected tickets = injectTicketDraft();

  /** The one placeholder to show, by id. Null lists every one of them. */
  public only = input<string | null>(null);

  private drafts = signal<Record<string, string>>({});

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
          days: daysLabel(standIn),
          age: standIn.state === 'open' && age ? ageLabel(age) : '',
          isOverdue: !!age?.isOverdue,
          canReopen: this.store.canReopen(standIn),
        };
      });
  });

  protected draftFor(id: string) {
    return this.drafts()[id] ?? '';
  }

  protected setDraft(id: string, issueKey: string) {
    this.drafts.update((all) => ({ ...all, [id]: issueKey }));
  }

  protected resolve(id: string) {
    this.store.resolve({ id, issueKey: this.draftFor(id) });
    this.setDraft(id, '');
  }
}

/** How long it has waited: the workdays since it was opened, and the time its bands already hold. */
const ageLabel = (age: StandInAge) => {
  const workdays = age.workdays === 1 ? '1 workday' : `${age.workdays} workdays`;

  return age.heldMs ? `${workdays} · ${formatDurationMs(age.heldMs)} held` : workdays;
};

/** The days a stand-in holds bands on, which are the days a resolve makes bookable. */
const daysLabel = (standIn: StandIn) => {
  const count = standIn.days.length;

  if (!count) return 'no day yet';

  return count === 1 ? `1 day · ${standIn.days[0]}` : `${count} days · ${standIn.days[0]} – ${standIn.days[count - 1]}`;
};
