import { Component, ViewEncapsulation, computed } from '@angular/core';
import {
  ACCORDION_IMPORTS,
  BUTTON_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { formatDurationMs } from '@ethlete/timetrack';
import { injectDayReview } from './day-review';
import { DayStreamsComponent } from './day-streams.component';
import { DayTotalsComponent } from './day-totals.component';
import { HiddenRowsComponent } from './hidden-rows.component';
import { LoggedElsewhereComponent } from './logged-elsewhere.component';
import { TimerRunLabel, TimerRunsComponent } from './timer-runs.component';

/**
 * What the collectors saw, behind one button.
 *
 * None of it is the day: the timeline says what will be logged, and every readout here says what was
 * measured or what somebody else already logged. They disagree by whatever the rounding moved, so
 * keeping them on the same screen made the day look wrong when it was right.
 */
@Component({
  selector: 'ethlete-day-debug',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h5" etOverlayTitle>Debug</h2>
    </div>

    <et-overlay-body>
      <et-accordion-group>
        <et-accordion label="What was measured">
          <ethlete-day-totals [day]="store.day()" />
        </et-accordion>

        <et-accordion [label]="streamsLabel()">
          <ethlete-day-streams [day]="store.day()" [headBranches]="store.headBranches()" />
        </et-accordion>

        <et-accordion [label]="loggedLabel()">
          <div class="flex flex-col gap-3">
            <ethlete-logged-elsewhere [coverage]="store.coverage()" [privateTime]="store.privateTime()" />

            @if (store.timerRuns().length) {
              <ethlete-timer-runs
                [runs]="store.timerRuns()"
                [openRunId]="store.openRunId()"
                (label)="labelRun($event)"
              />
            }
          </div>
        </et-accordion>

        <et-accordion [label]="hiddenLabel()">
          <ethlete-hidden-rows [rows]="store.hiddenRows()" (show)="store.show($event)" />
        </et-accordion>
      </et-accordion-group>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ACCORDION_IMPORTS,
    BUTTON_IMPORTS,
    DayStreamsComponent,
    DayTotalsComponent,
    HiddenRowsComponent,
    LoggedElsewhereComponent,
    OVERLAY_CONTENT_IMPORTS,
    TimerRunsComponent,
  ],
  hostDirectives: [OverlayMainDirective],
})
export class DayDebugComponent {
  protected store = injectDayReview();

  protected streamsLabel = computed(() => {
    const count = this.store.day()?.streams.length ?? 0;

    if (!count) return 'Streams — nothing observed';

    const engaged = formatDurationMs(this.store.day()?.engagedMs ?? 0);

    return `Streams — ${count} ${count === 1 ? 'checkout' : 'checkouts'}, ${engaged} engaged`;
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

  protected labelRun(label: TimerRunLabel) {
    this.store.labelRun(label.id, { issueKey: label.issueKey, note: label.note });
  }
}

export const DAY_DEBUG_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: DayDebugComponent,
  strategies: dialogOverlayStrategy({ width: 'min(860px, 90%)', maxWidth: '90%' }),
});
