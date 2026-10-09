import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, SpinnerComponent, createOverlayOpener } from '@ethlete/components';
import {
  DEFAULT_ROUND_OPTIONS,
  changedAfterBooking,
  describeApproval,
  formatDurationMs,
  frozenDayPeerBands,
  localDayRange,
  ontoDay,
} from '@ethlete/timetrack';
import { APPROVAL_QUEUE_OVERLAY } from '../agent/approval-queue.component';
import { injectRecurringPatterns } from '../naming/recurring-patterns';
import { injectPeers } from '../peers';
import { injectBandApprovals } from './band-approvals';
import { injectDayReview } from './day-review';
import { DayConcurrencyComponent } from './day-concurrency.component';
import { DAY_DEBUG_OVERLAY } from './day-debug.component';
import { DayTimelineComponent } from './day-timeline.component';
import { NamingOfferComponent } from './naming-offer.component';
import { DayWarningsComponent } from './day-warnings.component';
import { formatDayLabel, formatSignedDurationMs } from './format';
import { injectRowEditSurface } from './row-edit/row-edit-surface';

/** What the header's own button drafts: the quarter-hour grid, and the hour that just finished. */
const ENTRY_STEP_MS = DEFAULT_ROUND_OPTIONS.incrementMs;
const DEFAULT_ENTRY_MS = 60 * 60_000;

/**
 * One day of work, drawn as a scheduler.
 *
 * The timeline is the screen: a band is pressed to name it, dragged to move it and cut at its own
 * boundary, and every edit happens on the scheduler's edit surface rather than in a list beside it.
 * Nothing sits between the timeline and the footer. The work waiting for a name, the day's notes and
 * every readout are behind the Debug button; see `ethlete-day-debug`.
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
          @if (changed()) {
            <span
              class="text-small text-et-warning-ink"
              data-changed-after-booking
              title="Events arrived after this day was booked. The booked rows stay as they are."
            >
              Changed after booking
            </span>
          }
        </div>

        <div class="flex items-center gap-2">
          @if (placed.unplaced().length; as count) {
            <button
              [title]="unplacedTitle()"
              (click)="approvals.open()"
              class="rounded-full border border-dashed border-et-brand-ink px-3 text-small leading-7 text-et-brand-ink hover:bg-et-brand/10"
              data-waiting-pill
              type="button"
            >
              {{ count }} more waiting
            </button>
          }
          <button (click)="addEntry()" et-button variant="outline" size="sm">Add an entry</button>
          <button (click)="debug.open()" et-button variant="transparent" size="sm">Debug</button>
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
        @if (store.namingOffers().length) {
          <div class="shrink-0 border-b border-et-surface-border px-6 pb-3">
            <ethlete-naming-offer
              [offers]="store.namingOffers()"
              (accept)="store.acceptNamingOffer($event)"
              (dismiss)="store.declineNamingOffer($event)"
            />
          </div>
        }

        @if (historyFailure(); as failure) {
          <p class="shrink-0 px-6 pb-3 text-small text-et-warning-ink" data-tempo-history-failed>
            Tempo history could not be read, so tickets are matched without it: {{ failure }}
          </p>
        }

        @if (day.check.warnings.length) {
          <div
            class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-et-surface-border px-6 pb-3"
          >
            <ethlete-day-warnings [warnings]="day.check.warnings" class="min-w-0 grow" />
          </div>
        }

        <ethlete-day-timeline
          [behind]="day.behind"
          [breaks]="store.breaks()"
          [focusedDate]="focusedDate()"
          [peers]="peerBands()"
          [rows]="store.rows()"
          (boundaryMove)="store.moveBoundary($event)"
          (breakClear)="store.clearBreak($event)"
          (breakDraw)="store.stateAway($event)"
          (rowReschedule)="store.rescheduleRow($event)"
          class="min-h-0 grow px-6 pb-3"
        />

        <footer
          class="flex shrink-0 flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-et-surface-border px-6 py-3"
        >
          <span class="text-large">{{ proposed() }}</span>
          <span class="text-small text-et-surface-muted">of a {{ target() }} target ({{ delta() }})</span>
          @if (concurrency(); as concurrency) {
            <ethlete-day-concurrency [concurrency]="concurrency" />
          }
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
    DayConcurrencyComponent,
    DayTimelineComponent,
    DayWarningsComponent,
    NamingOfferComponent,
    SpinnerComponent,
  ],
  host: { class: 'flex min-h-0 grow flex-col' },
})
export class DayReviewViewComponent {
  protected store = injectDayReview();
  private surface = injectRowEditSurface();
  private recurring = injectRecurringPatterns();
  private peers = injectPeers();

  protected placed = injectBandApprovals();
  protected historyFailure = computed(() => {
    const read = this.recurring.state();

    return read.state === 'failed' ? read.message : null;
  });
  protected debug = createOverlayOpener(DAY_DEBUG_OVERLAY);
  protected approvals = createOverlayOpener(APPROVAL_QUEUE_OVERLAY);

  protected unplacedTitle = computed(() =>
    this.placed
      .unplaced()
      .map((item) => describeApproval(item.request))
      .join('\n'),
  );

  protected dayLabel = computed(() => formatDayLabel(this.store.dayKey()));

  private frozen = computed(() => {
    const frozen = this.store.storedEdits()?.frozenRows;
    const current = this.store.day();

    return frozen && current ? { frozen, current } : null;
  });

  protected peerBands = computed(() => {
    const day = this.frozen();

    if (!day) return [];

    return frozenDayPeerBands({
      ...day,
      machineNames: Object.fromEntries(this.peers.paired().map((machine) => [machine.machineId, machine.label])),
      foreignIssues: (this.store.coverage()?.issues ?? []).map((issue) => issue.issueKey),
    });
  });

  protected changed = computed(() => {
    const day = this.frozen();

    return !!day && changedAfterBooking({ frozen: day.frozen, current: day.current.rows });
  });
  protected focusedDate = computed(() => localDayRange(this.store.dayKey(), this.store.boundary()).from);

  protected proposed = computed(() => formatDurationMs(this.store.review()?.check.proposedMs ?? 0));

  protected covered = computed(() => {
    const coveredMs = this.store.review()?.check.coveredMs ?? 0;

    return coveredMs > 0 ? formatDurationMs(coveredMs) : null;
  });

  protected concurrency = computed(() => this.store.concurrency());
  protected target = computed(() => formatDurationMs(this.store.targetMs()));
  protected delta = computed(() => formatSignedDurationMs(this.store.review()?.check.deltaMs ?? 0));
  protected unattributed = computed(() => formatDurationMs(this.store.review()?.check.unattributedMs ?? 0));

  /**
   * Drafts a row over the hour the reviewer is most likely to mean: the one that just finished, at the
   * same clock time on the day on screen when that is another day.
   */
  protected addEntry() {
    const from = new Date(Math.floor(Date.now() / ENTRY_STEP_MS) * ENTRY_STEP_MS - DEFAULT_ENTRY_MS);

    this.surface.openDraft(
      ontoDay(
        { from, to: new Date(from.getTime() + DEFAULT_ENTRY_MS) },
        { day: this.store.dayKey(), boundary: this.store.boundary() },
      ),
    );
  }
}
