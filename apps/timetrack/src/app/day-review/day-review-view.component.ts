import { Component, ViewEncapsulation, computed } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, EMPTY_STATE_IMPORTS, SpinnerComponent } from '@ethlete/components';
import { DayWarningKind, ReviewedRow, formatDurationMs, localDayRange } from '@ethlete/timetrack';
import { injectDayReview } from './day-review';
import { DayTimelineComponent } from './day-timeline.component';
import { formatDayLabel, formatSignedDurationMs } from './format';
import { TimerRunLabel, TimerRunsComponent } from './timer-runs.component';
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
            } @else {
              <et-empty-state
                description="Nothing on this day could be attributed to an issue. The timeline shows what was observed."
                heading="No worklogs to review"
              />
            }

            @if (store.unnamed().length) {
              <ethlete-unnamed-work [contexts]="store.unnamed()" (name)="nameContext($event)" />
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

  protected proposed = computed(() => formatDurationMs(this.store.review()?.check.proposedMs ?? 0));
  protected target = computed(() => formatDurationMs(this.store.targetMs()));
  protected delta = computed(() => formatSignedDurationMs(this.store.review()?.check.deltaMs ?? 0));
  protected unattributed = computed(() => formatDurationMs(this.store.review()?.check.unattributedMs ?? 0));

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
