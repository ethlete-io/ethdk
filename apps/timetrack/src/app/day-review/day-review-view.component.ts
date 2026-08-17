import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { DayWarningKind, ReviewedRow, formatDurationMs, localDayRange } from '@ethlete/timetrack';
import { BranchRepairComponent } from './branch-repair.component';
import { injectBranchRepair } from './branch-repair';
import { CreateTicketComponent } from './create-ticket.component';
import { injectDayReview } from './day-review';
import { DayTimelineComponent } from './day-timeline.component';
import { formatDayLabel, formatSignedDurationMs } from './format';
import { TimerRunLabel, TimerRunsComponent } from './timer-runs.component';
import { injectTicketDraft } from './ticket-draft';
import { ContextNaming, UnnamedWorkComponent } from './unnamed-work.component';
import { WorklogRowComponent } from './worklog-row.component';

@Component({
  selector: 'ethlete-day-review',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div class="flex items-center gap-2">
          <button (click)="store.shiftDay(-1)" et-button variant="outline" size="sm" aria-label="Previous day">
            ←
          </button>
          <h2 class="text-h3">{{ dayLabel() }}</h2>
          <button (click)="store.shiftDay(1)" et-button variant="outline" size="sm" aria-label="Next day">→</button>
          <button (click)="store.goToToday()" et-button variant="transparent" size="sm">Today</button>
        </div>

        <button (click)="store.recorrelate()" et-button variant="outline" size="sm">Re-correlate</button>
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pb-4">
          <et-banner [description]="failure" type="error" heading="This day could not be read" />
        </div>
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 px-6 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Reading the day…</span>
        </div>
      } @else if (store.review(); as day) {
        @if (day.check.warnings.length) {
          <div class="flex shrink-0 flex-col gap-2 px-6 pb-4">
            @for (warning of day.check.warnings; track warning.kind) {
              <et-banner [description]="warning.detail" [heading]="WARNING_HEADINGS[warning.kind]" type="warning" />
            }
          </div>
        }

        <div class="grid min-h-0 grow gap-6 px-6 lg:grid-cols-[minmax(20rem,1fr)_clamp(20rem,30%,34rem)]">
          <ethlete-day-timeline
            [focusedDate]="focusedDate()"
            [rows]="store.rows()"
            [unattributed]="unattributedBlocks()"
            (rowSelect)="store.toggleExpanded($event.id)"
            (boundaryMove)="store.moveBoundary($event)"
          />

          <div class="flex min-h-0 flex-col gap-3 overflow-y-auto pb-6">
            @if (store.rows().length) {
              @for (row of store.rows(); track row.id) {
                <ethlete-worklog-row
                  [row]="row"
                  [expanded]="store.expanded().has(row.id)"
                  [selected]="store.selection().includes(row.id)"
                  [synced]="store.syncedIds().has(row.id)"
                  (issueChange)="store.setIssue(row, $event)"
                  (descriptionChange)="store.setDescription(row, $event)"
                  (durationChange)="store.setDuration(row, $event)"
                  (stateChange)="store.setState(row, $event)"
                  (expandToggle)="store.toggleExpanded(row.id)"
                  (mergeToggle)="store.toggleSelected(row.id)"
                  (split)="splitInHalf(row)"
                  (revert)="store.reset(row)"
                />
              }
            } @else if (!store.unnamed().length) {
              <!--
                Only when there is nothing to answer either. A day whose work is all unnamed has the
                naming card right below, and an empty state above it says the opposite of the truth.
              -->
              <et-empty-state
                description="Nothing on this day could be attributed to an issue. The timeline shows what was observed."
                heading="No worklogs to review"
              />
            }

            @if (store.unnamed().length) {
              <ethlete-unnamed-work
                [contexts]="store.unnamed()"
                [rules]="store.rulesByContext()"
                [suggestions]="store.inferredByContext()"
                [payload]="store.reasoningPayload()"
                [canAsk]="store.canAsk()"
                [isAsking]="store.isAsking()"
                [hasAsked]="store.hasAsked()"
                (name)="nameContext($event)"
                (ask)="store.ask()"
                (createTicket)="tickets.open($event)"
                (markPrivate)="store.markPathPrivate($event)"
                (forget)="store.forgetRule($event)"
              />
            }

            @for (entry of privateTime(); track entry.id) {
              <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
                <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>
                <span class="grow break-all text-mono text-small text-et-surface-muted">{{ entry.path }}</span>
                <span class="text-small text-et-surface-subtle">private — never logged</span>
              </div>
            }

            @if (tickets.context(); as drafting) {
              <ethlete-create-ticket
                [context]="drafting"
                [form]="tickets.form()"
                [candidates]="tickets.candidates()"
                [isSearching]="tickets.isSearching()"
                [isCreating]="tickets.isCreating()"
                [canCreate]="tickets.canCreate()"
                [createdKey]="tickets.createdKey()"
                [searchFailure]="tickets.searchFailure()"
                [createFailure]="tickets.createFailure()"
                (projectKeyChange)="tickets.setProjectKey($event)"
                (summaryChange)="tickets.setSummary($event)"
                (descriptionChange)="tickets.setDescription($event)"
                (parentKeyChange)="tickets.setParentKey($event)"
                (findParents)="tickets.findParents()"
                (create)="tickets.create()"
                (dismiss)="tickets.close()"
              />
            }

            @if (repairOffer(); as offer) {
              <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
                <span class="grow text-small">
                  {{ offer.branch }} still names no issue. It can be renamed to carry {{ offer.issueKey }}.
                </span>
                <button (click)="repair.open(offer)" et-button variant="outline" size="sm">Show me the steps</button>
              </div>
            }

            @if (repair.isReading()) {
              <div class="flex items-center gap-3 text-et-surface-muted">
                <et-spinner size="sm" />
                <span class="text-small">Reading the repository…</span>
              </div>
            }

            @if (repair.readFailure(); as failure) {
              <et-banner [description]="failure" type="error" heading="The repository could not be read" />
            }

            @if (repair.plan(); as plan) {
              <ethlete-branch-repair
                [plan]="plan"
                [outcome]="repair.outcome()"
                [isRunning]="repair.isRunning()"
                [canRun]="repair.canRun()"
                (run)="repair.run()"
                (dismiss)="repair.close()"
              />
            }

            @if (store.timerRuns().length) {
              <ethlete-timer-runs
                [runs]="store.timerRuns()"
                [openRunId]="store.openRunId()"
                (label)="labelRun($event)"
              />
            }
          </div>
        </div>

        @if (store.selection().length; as selected) {
          <div class="mx-6 mb-4 flex shrink-0 items-center gap-3 rounded-md border border-et-brand-ink p-3">
            <span class="grow text-small">{{ selected }} row(s) selected.</span>

            <button [disabled]="selected < 2" (click)="store.mergeSelection()" et-button variant="filled" size="sm">
              Merge into one
            </button>
            <button (click)="store.clearSelection()" et-button variant="transparent" size="sm">Clear</button>
          </div>
        }

        <footer
          class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-et-surface-border px-6 py-3"
        >
          <span class="text-large">{{ proposed() }}</span>
          <span class="text-small text-et-surface-muted">of a {{ target() }} target ({{ delta() }})</span>
          @if (covered(); as coveredTime) {
            <span class="text-small text-et-surface-muted">{{ coveredTime }} logged outside this app</span>
          }
          <span class="text-small text-et-surface-muted">{{ store.syncedRowCount() }} row(s) already in Tempo</span>
          @if (day.check.unattributedMs > 0) {
            <span class="text-small text-et-warning-ink">{{ unattributed() }} unattributed</span>
          }
        </footer>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BANNER_IMPORTS,
    BUTTON_IMPORTS,
    BranchRepairComponent,
    CreateTicketComponent,
    DayTimelineComponent,
    EMPTY_STATE_IMPORTS,
    SpinnerComponent,
    TimerRunsComponent,
    UnnamedWorkComponent,
    WorklogRowComponent,
  ],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class DayReviewViewComponent {
  protected store = injectDayReview();
  protected tickets = injectTicketDraft();
  protected repair = injectBranchRepair();

  protected readonly WARNING_HEADINGS: Record<DayWarningKind, string> = {
    'under-target': 'The day is short of its target',
    'over-target': 'The day is over its target',
    'unattributed-time': 'Some time matched no issue',
    'too-many-rows': 'This day fragmented',
    'zero-duration': 'A row rounded away to nothing',
    'meeting-overlap': 'A meeting and observed work claim the same time',
    'timer-unobserved': 'A timer ran while nothing was observed',
    'filled-time': 'Short pauses were logged as the work around them',
    'paused-time': 'You stopped collection for part of this day',
    'edited-row-drift': 'New evidence landed under a row you edited',
  };

  protected dayLabel = computed(() => formatDayLabel(this.store.dayKey()));
  protected focusedDate = computed(() => localDayRange(this.store.dayKey()).from);

  /** The time nothing could attribute, shown on the timeline behind the rows but never as a worklog. */
  protected unattributedBlocks = computed(() =>
    (this.store.correlation()?.unattributed ?? []).flatMap((group) => group.blocks),
  );

  /**
   * The repair a just-filed ticket makes possible. It appears only once the key exists, because the
   * whole point of repair is to put that key into the branch name.
   */
  protected repairOffer = computed(() => {
    const issueKey = this.tickets.createdKey();
    const context = this.tickets.context()?.context;

    if (!issueKey || !context?.repoPath || !this.repair.isRepairable(context.branch) || this.repair.target()) {
      return null;
    }

    return { repoPath: context.repoPath, branch: context.branch ?? '', issueKey };
  });

  protected proposed = computed(() => formatDurationMs(this.store.review()?.check.proposedMs ?? 0));

  protected covered = computed(() => {
    const coveredMs = this.store.review()?.check.coveredMs ?? 0;

    return coveredMs > 0 ? formatDurationMs(coveredMs) : null;
  });

  protected target = computed(() => formatDurationMs(this.store.targetMs()));
  protected delta = computed(() => formatSignedDurationMs(this.store.review()?.check.deltaMs ?? 0));
  protected unattributed = computed(() => formatDurationMs(this.store.review()?.check.unattributedMs ?? 0));

  protected privateTime = computed(() =>
    this.store.privateTime().map((entry) => ({
      id: entry.link.id,
      path: entry.link.path,
      duration: formatDurationMs(entry.observedMs),
    })),
  );

  protected nameContext(naming: ContextNaming) {
    this.store.nameContext(naming.context, naming.target);
  }

  protected labelRun(label: TimerRunLabel) {
    this.store.labelRun(label.id, { issueKey: label.issueKey, note: label.note });
  }

  protected splitInHalf(row: ReviewedRow) {
    this.store.split(row, new Date((row.from.getTime() + row.to.getTime()) / 2));
  }
}
