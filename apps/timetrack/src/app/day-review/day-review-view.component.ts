import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { DEFAULT_ROUND_OPTIONS, formatDurationMs, localDayRange } from '@ethlete/timetrack';
import { BranchRepairComponent } from './branch-repair.component';
import { injectBranchRepair } from './branch-repair';
import { CreateTicketComponent } from './create-ticket.component';
import { injectDayReview } from './day-review';
import { DayNotesComponent } from './day-notes.component';
import { DayStreamsComponent } from './day-streams.component';
import { DayTimelineComponent } from './day-timeline.component';
import { DayTotalsComponent } from './day-totals.component';
import { DayWarningsComponent } from './day-warnings.component';
import { formatDayLabel, formatSignedDurationMs } from './format';
import { IssueFilterComponent } from '../jira';
import { LoggedElsewhereComponent } from './logged-elsewhere.component';
import { HiddenRowsComponent } from './hidden-rows.component';
import { TimerRunLabel, TimerRunsComponent } from './timer-runs.component';
import { injectRowEditSurface } from './row-edit/row-edit-surface';
import { injectTicketDraft } from './ticket-draft';
import { ContextNaming, UnnamedWorkComponent } from './unnamed-work.component';

/** What the header's own button drafts: the quarter-hour grid, and the hour that just finished. */
const ENTRY_STEP_MS = DEFAULT_ROUND_OPTIONS.incrementMs;
const DEFAULT_ENTRY_MS = 60 * 60_000;

/**
 * One day of work, drawn as a scheduler.
 *
 * The timeline is the screen: a band is pressed to name it, dragged to move it and cut at its own
 * boundary, and every edit happens on the scheduler's edit surface rather than in a list beside it.
 * What is not a band lives in a closed strip underneath — the streams behind the day, the work still
 * waiting for a name, the time logged outside this app, and the day's notes.
 */
@Component({
  selector: 'ethlete-day-review',
  template: `
    <div class="flex min-h-0 grow flex-col">
      <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-3">
        <div class="flex items-center gap-2">
          <button (click)="store.shiftDay(-1)" et-button variant="outline" size="sm" aria-label="Previous day">
            ←
          </button>
          <h2 class="text-h3">{{ dayLabel() }}</h2>
          <button (click)="store.shiftDay(1)" et-button variant="outline" size="sm" aria-label="Next day">→</button>
          @if (!store.isToday()) {
            <button (click)="store.goToToday()" et-button variant="transparent" size="sm">Today</button>
          }
        </div>

        <div class="flex items-center gap-2">
          <button (click)="addEntry()" et-button variant="outline" size="sm">Add an entry</button>
          <button (click)="store.recorrelate()" et-button variant="outline" size="sm">Re-correlate</button>
        </div>
      </header>

      @if (store.failure(); as failure) {
        <div class="shrink-0 px-6 pb-3">
          <et-banner [description]="failure" type="error" heading="This day could not be read" />
        </div>
      }

      @if (store.isLoading()) {
        <div class="flex items-center gap-3 px-6 text-et-surface-muted">
          <et-spinner />
          <span class="text-base">Reading the day…</span>
        </div>
      } @else if (store.review(); as day) {
        <div class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-et-surface-border px-6 pb-3">
          <ethlete-day-totals [day]="store.day()" />
          <ethlete-day-warnings [warnings]="day.check.warnings" class="min-w-0 grow" />
        </div>

        <ethlete-day-timeline
          [breaks]="store.day()?.breaks ?? []"
          [focusedDate]="focusedDate()"
          [rows]="store.rows()"
          (boundaryMove)="store.moveBoundary($event)"
          (rowHide)="store.hide($event)"
          (rowReschedule)="store.rescheduleRow($event)"
          (rowSplit)="store.split($event.row, $event.at)"
          (rowsMerge)="store.mergeRows($event)"
          class="min-h-0 grow px-6"
        />

        <div class="flex shrink-0 flex-wrap items-start gap-2 px-6 py-3">
          <ethlete-day-streams
            [day]="store.day()"
            [headBranches]="store.headBranches()"
            class="block has-[details[open]]:w-full"
          />

          <details class="rounded-md border border-et-surface-border open:w-full" data-waiting>
            <summary class="cursor-pointer px-3 py-2 text-small text-et-surface-muted">{{ waitingLabel() }}</summary>

            <div class="flex max-h-96 flex-col gap-3 overflow-y-auto px-3 pb-3">
              <ethlete-issue-filter />

              @if (store.unnamed().length) {
                <ethlete-unnamed-work
                  [contexts]="store.unnamed()"
                  [rules]="store.rulesByContext()"
                  [suggestions]="store.inferredByContext()"
                  [payload]="store.reasoningPayload()"
                  [canAsk]="store.canAsk()"
                  [isAsking]="store.isAsking()"
                  [hasAsked]="store.hasAsked()"
                  [askFailure]="store.askFailure()"
                  [askedInVain]="store.askedInVain()"
                  (name)="nameContext($event)"
                  (ask)="store.ask()"
                  (createTicket)="tickets.open($event)"
                  (markPrivate)="store.markPathPrivate($event)"
                  (forget)="store.forgetRule($event)"
                />
              } @else {
                <et-empty-state
                  description="Every band on this day is named, or nothing was observed that a rule could not read."
                  heading="Nothing is waiting for a name"
                />
              }

              @if (tickets.context(); as drafting) {
                <ethlete-create-ticket
                  [context]="drafting"
                  [form]="tickets.form()"
                  [candidates]="tickets.candidates()"
                  [existing]="tickets.existing()"
                  [agentMatch]="tickets.agentMatch()"
                  [payload]="tickets.writingRequest()"
                  [isSearching]="tickets.isSearching()"
                  [canWrite]="tickets.canWrite()"
                  [isWriting]="tickets.isWriting()"
                  [isCreating]="tickets.isCreating()"
                  [canCreate]="tickets.canCreate()"
                  [createdKey]="tickets.createdKey()"
                  [searchFailure]="tickets.searchFailure()"
                  [writeFailure]="tickets.writeFailure()"
                  [createFailure]="tickets.createFailure()"
                  (projectKeyChange)="tickets.setProjectKey($event)"
                  (summaryChange)="tickets.setSummary($event)"
                  (descriptionChange)="tickets.setDescription($event)"
                  (parentKeyChange)="tickets.setParentKey($event)"
                  (findParents)="tickets.findParents()"
                  (write)="tickets.writeWithAgent()"
                  (useExisting)="tickets.useExisting($event)"
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
            </div>
          </details>

          <details class="rounded-md border border-et-surface-border open:w-full" data-logged>
            <summary class="cursor-pointer px-3 py-2 text-small text-et-surface-muted">{{ loggedLabel() }}</summary>

            <div class="flex max-h-96 flex-col gap-3 overflow-y-auto px-3 pb-3">
              <ethlete-logged-elsewhere [coverage]="store.coverage()" [privateTime]="store.privateTime()" />

              @if (store.timerRuns().length) {
                <ethlete-timer-runs
                  [runs]="store.timerRuns()"
                  [openRunId]="store.openRunId()"
                  (label)="labelRun($event)"
                />
              }
            </div>
          </details>

          @if (store.hiddenRows().length) {
            <details class="rounded-md border border-et-surface-border open:w-full" data-hidden>
              <summary class="cursor-pointer px-3 py-2 text-small text-et-surface-muted">{{ hiddenLabel() }}</summary>

              <div class="flex max-h-96 flex-col gap-3 overflow-y-auto px-3 pb-3">
                <ethlete-hidden-rows [rows]="store.hiddenRows()" (show)="store.show($event)" />
              </div>
            </details>
          }

          <details class="rounded-md border border-et-surface-border open:w-full" data-notes>
            <summary class="cursor-pointer px-3 py-2 text-small text-et-surface-muted">Day notes</summary>

            <div class="px-3 pb-3">
              <ethlete-day-notes [day]="store.day()" />
            </div>
          </details>
        </div>

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
    DayNotesComponent,
    DayStreamsComponent,
    DayTimelineComponent,
    DayTotalsComponent,
    DayWarningsComponent,
    EMPTY_STATE_IMPORTS,
    IssueFilterComponent,
    LoggedElsewhereComponent,
    SpinnerComponent,
    HiddenRowsComponent,
    TimerRunsComponent,
    UnnamedWorkComponent,
  ],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class DayReviewViewComponent {
  protected store = injectDayReview();
  protected tickets = injectTicketDraft();
  protected repair = injectBranchRepair();
  private surface = injectRowEditSurface();

  protected dayLabel = computed(() => formatDayLabel(this.store.dayKey()));
  protected focusedDate = computed(() => localDayRange(this.store.dayKey(), this.store.boundary()).from);

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

  protected waitingLabel = computed(() => {
    const contexts = this.store.unnamed().length;

    return contexts ? `Waiting for a name — ${contexts} context(s)` : 'Waiting for a name — none';
  });

  protected loggedLabel = computed(() => {
    const runs = this.store.timerRuns().length;
    const elsewhere = this.store.coverage()?.issues.length ?? 0;
    const secluded = this.store.privateTime().length;

    return `Logged elsewhere — ${elsewhere} in Tempo, ${secluded} private, ${runs} timed run(s)`;
  });

  protected hiddenLabel = computed(() => {
    const hidden = this.store.hiddenRows();
    const ms = hidden.reduce((sum, row) => sum + (row.to.getTime() - row.from.getTime()), 0);

    return `Hidden — ${hidden.length} row(s), ${formatDurationMs(ms)}`;
  });

  /** Drafts a row over the hour the reviewer is most likely to mean: the one that just finished. */
  protected addEntry() {
    const from = new Date(Math.floor(Date.now() / ENTRY_STEP_MS) * ENTRY_STEP_MS - DEFAULT_ENTRY_MS);

    this.surface.openDraft({ from, to: new Date(from.getTime() + DEFAULT_ENTRY_MS) });
  }

  protected nameContext(naming: ContextNaming) {
    this.store.nameContext(naming.context, naming.target);
  }

  protected labelRun(label: TimerRunLabel) {
    this.store.labelRun(label.id, { issueKey: label.issueKey, note: label.note });
  }
}
