import { Component, computed, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { QueryDevtoolsEntry, QueryDevtoolsRun } from '@ethlete/query';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsTimelineStylesComponent } from './query-devtools-timeline-styles.component';
import { AnyQuery, Timeline, TimelineRow } from './query-devtools-types';

/** Past this many rows, the timeline keeps the newest and counts the rest instead of drawing them. */
const MAX_TIMELINE_ROWS = 200;

/** Where the timeline's axis labels sit, as fractions of the window. */
const TIMELINE_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** The Timeline tab: every scoped query's runs laid out on one shared axis, so overlap and chains show. */
@Component({
  selector: 'et-query-devtools-timeline-tab',
  templateUrl: './query-devtools-timeline-tab.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsDrawerComponent],
})
export class QueryDevtoolsTimelineTabComponent {
  protected host = injectQueryDevtoolsHost();

  /**
   * Every run the scoped queries have recorded, oldest first. The client picker and the inspection
   * filter narrow the timeline the same way they narrow the Queries list.
   */
  private scopedRuns = computed(() => {
    const collected: { entry: QueryDevtoolsEntry; run: QueryDevtoolsRun }[] = [];

    for (const entry of this.host.scopedQueries()) {
      for (const run of entry.stats?.runs() ?? []) collected.push({ entry, run });
    }

    return collected.sort((a, b) => a.run.startedAt - b.run.startedAt);
  });

  /**
   * Every scoped run laid out on one axis, so a stampede reads as overlapping bars and a chain as a
   * staircase - which is what the Events tab's flat list of wall-clock times cannot show.
   */
  protected timeline = computed<Timeline>(() => {
    const collected = this.scopedRuns();
    const hidden = Math.max(0, collected.length - MAX_TIMELINE_ROWS);
    const shown = hidden ? collected.slice(hidden) : collected;
    const first = shown[0];

    if (!first) return { rows: [], startedAt: 0, windowMs: 0, hidden: 0 };

    // A run in flight has no end yet, so the window has to grow with the clock - otherwise its bar would
    // freeze at the width it happened to be built with, the same trap `isStale` documents.
    if (shown.some(({ run }) => run.endedAt === null)) this.host.clock();

    const now = Date.now();
    const startedAt = first.run.startedAt;
    const endedAt = shown.reduce((latest, { run }) => Math.max(latest, run.endedAt ?? now), startedAt);
    const windowMs = Math.max(1, endedAt - startedAt);

    const rows = shown.map(({ entry, run }): TimelineRow => {
      const url = run.url ?? this.host.requestUrl(entry.handle as AnyQuery);

      return {
        key: `${entry.id}:${run.index}`,
        entryId: entry.id,
        method: entry.meta.method ?? '',
        path: url ? this.host.requestPath(url) : (entry.meta.route ?? ''),
        run,
        leftPct: ((run.startedAt - startedAt) / windowMs) * 100,
        // An instant run - a cache entry filled by a poll or by another consumer - still needs a sliver
        // of width to be visible at all.
        widthPct: Math.max(0.4, (((run.endedAt ?? now) - run.startedAt) / windowMs) * 100),
        durationMs: run.endedAt === null ? null : run.endedAt - run.startedAt,
      };
    });

    return { rows, startedAt, windowMs, hidden };
  });

  /** Axis labels for the timeline, as offsets from the window's start. */
  protected timelineTicks = computed(() => {
    const { windowMs, rows } = this.timeline();

    if (!rows.length) return [];

    return TIMELINE_TICKS.map((fraction) => ({
      pct: fraction * 100,
      label: this.host.formatDuration(Math.round(windowMs * fraction)),
    }));
  });

  constructor() {
    // The waterfall's grid lays out nothing else in the panel, so its rules arrive with the tab - and
    // this component only exists while the tab is open, so mounting unconditionally here is enough.
    injectStyleManager().mount(QueryDevtoolsTimelineStylesComponent);
  }

  /** The same reset the drawer's Activity section offers, for every query the timeline covers. */
  protected resetTimeline() {
    for (const entry of this.host.scopedQueries()) entry.stats?.reset();

    this.host.diffRunIndex.set(null);
    this.host.diffBaseRunIndex.set(null);
  }

  protected selectTimelineRow(row: TimelineRow) {
    this.host.timelineSelectedQueryId.set(row.entryId);
  }
}
