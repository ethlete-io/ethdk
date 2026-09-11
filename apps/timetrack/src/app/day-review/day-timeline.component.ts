import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Appointment,
  MENU_IMPORTS,
  SCHEDULER_IMPORTS,
  SchedulerAppointmentDragMode,
  SchedulerAppointmentReschedule,
  SchedulerDirective,
  SchedulerTimeGridDirective,
  countDescendants,
} from '@ethlete/components';
import { DragGestureEvent, ProvideColorDirective, dragGestureFrom } from '@ethlete/core';
import { BreakWindow, DEFAULT_ROUND_OPTIONS, ReviewedRow, formatDurationMs } from '@ethlete/timetrack';
import { tap } from 'rxjs';
import { formatClockTime } from './format';
import { BREAK_LANE_KEY, BreakBand, DayLane, lanesOf, laneKeyOfRow } from './lanes';
import { TimelineEntry, UNNAMED_LABEL, appointmentLabel, appointmentOf, rowEntryOf } from './row-edit/row-appointment';
import { injectRowEditSurface } from './row-edit/row-edit-surface';

/** Whether the click asked to mark the band rather than to open it. */
const withModifier = (event: Event) =>
  event instanceof MouseEvent && (event.ctrlKey || event.metaKey || event.shiftKey);

/** Two rows that meet at one instant. Dragging that instant is what places a cut exactly. */
export type TimelineBoundary = { id: string; before: ReviewedRow; after: ReviewedRow };

export type BoundaryMove = { before: ReviewedRow; after: ReviewedRow; at: Date };

/** Where a row was dragged to, whether it moved whole or by one end. */
export type RowReschedule = { row: ReviewedRow; from: Date; to: Date };

/**
 * How tall one hour of the grid is. Generous on purpose: at anything tighter a quarter-hour block is
 * shorter than one line of text, and a run of them renders as a stack of half-clipped labels. The
 * 24-hour body scrolls inside its own bounded height, so the cost is scrolling, not legibility.
 */
const HOUR_REM = 8;

/** A block shorter than one line of text renders as a bare bar; its hover title is where it reads. */
const LABEL_MIN_REM = 2.2;

/** Two lines of text plus the block's own padding. Below this the description would clip mid-line. */
const DETAIL_MIN_REM = 5;

/** How tall one row of the all-day strip is, and the least it reserves when nothing is in it. */
const STRIP_ROW_REM = 2;

/**
 * The least a lane narrows to. A checkout's directory name has to stay readable, so a day of many
 * checkouts scrolls sideways rather than shrinking every lane to a sliver.
 */
const LANE_MIN_REM = 14;

/** How wide the break lane is. It carries no ticket and no gesture, so it stays narrow. */
const BREAK_LANE_REM = 6;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * What a dragged range snaps to. The rounding increment and nothing finer: a row whose clock says
 * 09:07 but whose duration rounded to the quarter hour is claiming a precision it does not have.
 */
const SNAP_MS = DEFAULT_ROUND_OPTIONS.incrementMs;

/** What a press that draws nothing creates. One increment is a bar nobody can see or grab. */
const DEFAULT_DRAFT_MS = 4 * SNAP_MS;

/** Where a press on a block lands: on one of its ends, or on the body that moves the whole of it. */
const EDGE_FRACTION = 0.25;
const MAX_EDGE_PX = 12;

type RowDrag = {
  row: ReviewedRow;
  mode: SchedulerAppointmentDragMode;
  /** How far into the day the pointer grabbed the block, so a move keeps that grip on it. */
  grabMs: number;
};

/**
 * The day as a scheduler.
 *
 * Every gesture the timeline offers is the headless scheduler's own: a range drawn on empty grid is a
 * draft range, a row dragged to another time is an appointment drag, and both preview themselves
 * because the layout reads `effectiveAppointments` rather than the rows. What this component adds is
 * what the grid cannot know — what a pointer position means in *this* day's geometry, and what the
 * quarter-hour increment a worklog is logged in snaps to.
 *
 * The stories the day rolls up to are drawn in the all-day strip, as the parents of the rows under
 * them. They are a grouping and never a worklog: an all-day appointment is laid out on the day axis
 * rather than the hour axis, so a band cannot steal width from the rows it groups.
 */
@Component({
  selector: 'ethlete-day-timeline',
  template: `
    <div
      [appointments]="appointments()"
      [focusedDate]="focusedDate()"
      (appointmentReschedule)="reschedule($event)"
      class="flex min-h-0 grow flex-col"
      etScheduler
      view="day"
    >
      <div #body #grid="etSchedulerTimeGrid" class="min-h-0 grow overflow-auto pb-6" etSchedulerTimeGrid>
        <div class="min-w-max">
          <div class="sticky top-0 z-20 flex bg-et-surface-bg">
            <div class="sticky left-0 w-13 shrink-0 bg-et-surface-bg"></div>

            @for (lane of lanes(); track lane.key) {
              <div
                [style.flexGrow]="growOf(lane)"
                [style.minWidth.rem]="minRemOf(lane)"
                [title]="lane.key"
                class="basis-0 truncate border-b border-l border-et-surface-border px-2 py-1 text-small text-et-surface-muted"
                data-lane-header
              >
                {{ lane.label }}
              </div>
            }
          </div>

          @if (grid.allDay().length) {
            <div [style.height.rem]="stripHeight(grid.allDayRowCount())" class="relative ml-13 mb-2">
              @for (entry of grid.allDay(); track entry.node.appointment.id) {
                <button
                  [etProvideColor]="entry.node.appointment.colorToken ?? 'neutral'"
                  [style.top.rem]="entry.row * STRIP_ROW_REM"
                  [style.left.%]="entry.inlineOffset"
                  [style.width.%]="entry.inlineSize"
                  [title]="entry.node.appointment.title"
                  (click)="select(entry.node.appointment, $event)"
                  class="absolute flex items-center gap-2 truncate rounded-sm border-l-2 border-l-et-theme bg-et-theme/10 px-2 text-left text-small"
                  style="height: 1.6rem"
                  type="button"
                >
                  <span class="truncate">{{ entry.node.appointment.title }}</span>
                  <span class="shrink-0 text-et-surface-muted">{{ COUNT_DESCENDANTS(entry.node) }} rows</span>
                </button>
              }
            </div>
          }

          <div #dayColumn [style.height.rem]="24 * HOUR_REM" class="relative">
            @for (hour of HOURS; track hour) {
              <div
                [style.top.rem]="hour * HOUR_REM"
                class="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
              >
                <span
                  class="sticky left-0 z-10 w-11 shrink-0 bg-et-surface-bg text-right text-mono text-et-surface-subtle"
                  >{{ labelFor(hour) }}</span
                >
                <span [attr.data-hour]="hour" class="h-px grow bg-et-surface-border"></span>
              </div>
            }

            <div class="absolute inset-y-0 right-0 left-13 flex">
              @for (lane of lanes(); track lane.key) {
                <div
                  #column
                  [style.flexGrow]="growOf(lane)"
                  [style.minWidth.rem]="minRemOf(lane)"
                  (pointerdown)="startDraw({ event: $event, column, lane })"
                  class="relative basis-0 touch-none border-l border-et-surface-border"
                  data-lane
                >
                  @if (draftIn(lane); as draft) {
                    <div
                      [style.top.%]="draft.offset"
                      [style.height.%]="draft.span"
                      class="pointer-events-none absolute inset-x-0 rounded-sm border border-dashed border-et-brand-ink bg-et-brand-ink/10"
                    ></div>
                  }

                  @for (band of lane.breaks; track band.window.from) {
                    <div
                      [style.top.%]="band.offset"
                      [style.height.%]="band.span"
                      [title]="breakTitle(band)"
                      class="absolute inset-x-0 flex flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border bg-et-surface-interaction px-2 py-1 text-small text-et-surface-muted"
                      data-break
                    >
                      @if (labelled(band.span)) {
                        <span class="block truncate">{{ breakLabel(band) }}</span>
                      }
                    </div>
                  }

                  @for (laid of lane.blocks; track laid.block.node.appointment.id) {
                    <div
                      [attr.data-kind]="kindOf(laid.block.node.appointment)"
                      [attr.data-dragging]="dragging(laid.block.node.appointment) || null"
                      [attr.data-marked]="marks(laid.block.node.appointment) || null"
                      [etProvideColor]="laid.block.node.appointment.colorToken ?? 'neutral'"
                      [style.top.%]="laid.block.offset"
                      [style.height.%]="laid.block.span"
                      [style.left.%]="laid.inlineOffset"
                      [style.width.%]="laid.inlineSize"
                      [title]="LABEL_OF(laid.block.node.appointment)"
                      (pointerdown)="startDrag({ event: $event, appointment: laid.block.node.appointment, column })"
                      (click)="select(laid.block.node.appointment, $event)"
                      (keydown.enter)="select(laid.block.node.appointment, $event)"
                      class="absolute flex cursor-grab touch-none flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small data-[dragging]:opacity-70 data-[marked]:ring-2 data-[marked]:ring-et-theme"
                      etMenu
                      etMenuContextTrigger
                      role="button"
                      tabindex="0"
                    >
                      @if (rowOf(laid.block.node.appointment); as row) {
                        <ng-template etMenuSurface>
                          <et-menu>
                            <button (click)="rowHide.emit(row)" et-menu-item type="button">Hide this row</button>
                            <button (click)="splitInHalf(row)" et-menu-item type="button">Split in half</button>

                            @if (markedCount() > 1) {
                              <et-menu-separator />
                              <button (click)="mergeMarked()" et-menu-item type="button">
                                Merge the {{ markedCount() }} marked rows
                              </button>
                            }
                          </et-menu>
                        </ng-template>
                      }

                      @if (labelled(laid.block.span)) {
                        <span class="block truncate">{{ LABEL_OF(laid.block.node.appointment) }}</span>
                      }
                      @if (detailed(laid.block.span) && descriptionOf(laid.block.node.appointment); as description) {
                        <span class="block truncate text-et-surface-muted">{{ description }}</span>
                      }
                    </div>
                  }

                  @for (boundary of boundariesIn(lane); track boundary.id) {
                    <div
                      [attr.aria-label]="labelOf(boundary)"
                      [attr.aria-valuemax]="minutesOf(limitsOf(boundary).max)"
                      [attr.aria-valuemin]="minutesOf(limitsOf(boundary).min)"
                      [attr.aria-valuenow]="minutesOf(instantOf(boundary).getTime())"
                      [attr.aria-valuetext]="clockOf(boundary)"
                      [style.top.%]="percentOf(instantOf(boundary))"
                      [attr.data-dragging]="draggingBoundary(boundary) || null"
                      (keydown)="nudge($event, boundary)"
                      (pointerdown)="startBoundaryDrag({ event: $event, boundary, column })"
                      class="group absolute inset-x-0 -mt-1 flex h-2 cursor-ns-resize touch-none items-center outline-none"
                      aria-orientation="horizontal"
                      role="separator"
                      tabindex="0"
                    >
                      <span
                        class="h-0.5 grow rounded-full bg-et-surface-subtle opacity-40 group-hover:bg-et-theme group-hover:opacity-100 group-focus-visible:bg-et-theme group-focus-visible:opacity-100 group-active:bg-et-theme group-active:opacity-100 group-data-[dragging]:bg-et-theme group-data-[dragging]:opacity-100"
                      ></span>
                      <span
                        class="ml-2 shrink-0 rounded-sm bg-et-surface-interaction px-1 text-mono opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 group-data-[dragging]:opacity-100"
                        >{{ clockOf(boundary) }}</span
                      >
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MENU_IMPORTS, ProvideColorDirective, SCHEDULER_IMPORTS],
  host: { class: 'flex min-h-0 flex-col' },
})
export class DayTimelineComponent {
  private destroyRef = inject(DestroyRef);
  private surface = injectRowEditSurface();

  public focusedDate = input.required<Date>();
  public rows = input.required<readonly ReviewedRow[]>();
  /** The day's breaks, from `StreamDay.breaks`. They get a lane of their own, and no gesture. */
  public breaks = input<readonly BreakWindow[]>([]);

  /** Where two adjacent rows should meet instead. */
  public boundaryMove = output<BoundaryMove>();
  /** Where a row was dragged to, whole or by one end. */
  public rowReschedule = output<RowReschedule>();

  /** A row the reviewer took off the timeline through the band's own menu. */
  public rowHide = output<ReviewedRow>();

  /** Where a row is to be cut, from the band's own menu. */
  public rowSplit = output<{ row: ReviewedRow; at: Date }>();

  /** The marked bands, earliest first, which the band menu offers to fold into one row. */
  public rowsMerge = output<readonly ReviewedRow[]>();

  private body = viewChild.required<ElementRef<HTMLElement>>('body');
  private dayColumn = viewChild<ElementRef<HTMLElement>>('dayColumn');
  public grid = viewChild(SchedulerTimeGridDirective);
  private scheduler = viewChild.required<SchedulerDirective<TimelineEntry>>(SchedulerDirective);

  /** The rows a modifier-click marked, by id. A plain click anywhere on a band clears them. */
  private marked = signal<ReadonlySet<string>>(new Set());

  /** The instant a boundary is being dragged to, until the pointer settles on it. */
  private boundaryDrag = signal<{ boundary: TimelineBoundary; at: Date } | null>(null);

  /** Whether the press now ending moved a block rather than being a click on it. */
  private hasDragged = false;

  /** Which lane a range is being drawn in, so the draft is previewed there and nowhere else. */
  private drawLane = signal<string | null>(null);

  protected readonly HOUR_REM = HOUR_REM;
  protected readonly STRIP_ROW_REM = STRIP_ROW_REM;
  protected readonly HOURS = Array.from({ length: 25 }, (_, hour) => hour);
  protected readonly COUNT_DESCENDANTS = countDescendants;
  protected readonly LABEL_OF = appointmentLabel;

  /** The day as one lane per checkout. The grid supplies the vertical geometry; the lane the inline. */
  protected lanes = computed<DayLane[]>(() =>
    lanesOf({ blocks: this.grid()?.days()[0]?.blocks ?? [], breaks: this.breaks(), dayStart: this.focusedDate() }),
  );

  /**
   * The pairs of rows that meet at one instant, by the lane they are in. A pair too short to keep a
   * step on either side of its boundary gets no handle: there is nowhere left to drag it to.
   *
   * Only rows of one checkout pair up. Dragging a boundary moves a slice of time from one row to the
   * other, and across two checkouts that would book one checkout's minutes to another.
   */
  private boundariesByLane = computed(() => {
    const rowsByLane = new Map<string, ReviewedRow[]>();

    for (const row of this.rows()) {
      const key = laneKeyOfRow(row);

      rowsByLane.set(key, [...(rowsByLane.get(key) ?? []), row]);
    }

    const boundariesOf = (rows: readonly ReviewedRow[]): TimelineBoundary[] => {
      const ordered = [...rows].sort((a, b) => a.from.getTime() - b.from.getTime());

      return ordered.flatMap((before, index) => {
        const after = ordered[index + 1];

        if (!after || before.to.getTime() !== after.from.getTime()) return [];
        if (after.to.getTime() - before.from.getTime() < 2 * SNAP_MS) return [];

        return [{ id: `${before.id}|${after.id}`, before, after }];
      });
    };

    return new Map([...rowsByLane].map(([key, rows]) => [key, boundariesOf(rows)]));
  });

  /**
   * The stories the day rolls up to, with the rows under each. Only a story two rows share: a band over
   * one row says nothing the row does not already say, and it would double every block on the strip.
   */
  private stories = computed(() => {
    const byStory = new Map<string, ReviewedRow[]>();

    for (const row of this.rows()) {
      if (!row.storyKey || row.storyKey === row.issueKey) continue;

      byStory.set(row.storyKey, [...(byStory.get(row.storyKey) ?? []), row]);
    }

    return [...byStory].filter(([, rows]) => rows.length > 1);
  });

  private storyIdOf = computed(() => {
    const found = new Map<string, string>();

    for (const [issueKey] of this.stories()) found.set(issueKey, `story:${issueKey}`);

    return found;
  });

  /**
   * The day as appointments. Every band is a row, including one nothing could name — the work waiting
   * for a name is a row that carries no issue yet, so drawing the blocks behind it as well would draw
   * the same hour twice. A story is an all-day appointment and the parent of its rows, which is what
   * puts it on the strip instead of into the rows' own column packing.
   */
  protected appointments = computed<Appointment<TimelineEntry>[]>(() => {
    const storyIds = this.storyIdOf();

    return [
      ...this.stories().map(([issueKey, rows]): Appointment<TimelineEntry> => ({
        id: storyIds.get(issueKey) ?? `story:${issueKey}`,
        parentId: null,
        title: issueKey,
        start: new Date(Math.min(...rows.map((row) => row.from.getTime()))),
        end: new Date(Math.max(...rows.map((row) => row.to.getTime()))),
        allDay: true,
        colorToken: 'brand',
        extra: { kind: 'story', issueKey },
      })),
      ...this.rows().map((row): Appointment<TimelineEntry> => {
        const drag = this.boundaryDrag();

        return appointmentOf({
          row,
          parentId: (row.storyKey && storyIds.get(row.storyKey)) ?? null,
          from: drag?.boundary.after.id === row.id ? drag.at : row.from,
          to: drag?.boundary.before.id === row.id ? drag.at : row.to,
        });
      }),
    ];
  });

  /**
   * The hour the day opens on: one hour of lead-in before its earliest band.
   *
   * The grid's own answer follows the clock on a day that is today, which opens an evening's screen on
   * empty grid when the work ended at noon. It is the right answer for a calendar and the wrong one
   * for a timesheet, where the whole day is what is being read.
   */
  private scrollHour = computed(() => {
    const starts = this.rows().map((row) => row.from.getTime());

    if (!starts.length) return this.grid()?.initialScrollHour() ?? 0;

    return Math.max(0, Math.floor((Math.min(...starts) - this.focusedDate().getTime()) / HOUR_MS) - 1);
  });

  /**
   * The marked rows in the order the timeline draws them, so the earliest supplies the merged row's
   * issue, description and lane — which is what `mergeRows` reads off the first row it is given.
   */
  private markedRows = computed(() => {
    const ids = this.marked();

    return this.rows().filter((row) => ids.has(row.id));
  });

  protected markedCount = computed(() => this.markedRows().length);

  constructor() {
    /**
     * Once, on mount: a 24-hour grid opened at midnight shows an empty screen. Scrolling on every
     * day change instead would yank the reviewer's own scroll position back each time they step a day.
     */
    afterNextRender(() => {
      const body = this.body().nativeElement;
      const hours = this.dayColumn()?.nativeElement;

      if (!hours) return;

      // `offsetTop` is measured against a shared offset parent, so the difference is where the hour
      // axis starts inside the scroller — the all-day strip above it is exactly what that accounts for.
      body.scrollTop = hours.offsetTop - body.offsetTop + (hours.offsetHeight / 24) * this.scrollHour();
    });
  }

  /** `span` is a percentage of the day, so this is the height the block actually renders at. */
  protected labelled(span: number) {
    return (span / 100) * 24 * HOUR_REM >= LABEL_MIN_REM;
  }

  protected detailed(span: number) {
    return (span / 100) * 24 * HOUR_REM >= DETAIL_MIN_REM;
  }

  protected boundariesIn(lane: DayLane) {
    return this.boundariesByLane().get(lane.key) ?? [];
  }

  /** The drawn range, in the lane the draw started in. Every other lane previews nothing. */
  protected draftIn(lane: DayLane) {
    return this.drawLane() === lane.key ? this.grid()?.draftBlock() : null;
  }

  protected minRemOf(lane: DayLane) {
    return lane.key === BREAK_LANE_KEY ? BREAK_LANE_REM : LANE_MIN_REM;
  }

  protected growOf(lane: DayLane) {
    return lane.key === BREAK_LANE_KEY ? 0 : 1;
  }

  protected breakLabel(band: BreakBand) {
    return formatDurationMs(band.window.to.getTime() - band.window.from.getTime());
  }

  protected breakTitle(band: BreakBand) {
    const clock = `${formatClockTime(band.window.from)} - ${formatClockTime(band.window.to)}`;

    return band.window.locked ? `${clock} - the screen was locked` : clock;
  }

  protected stripHeight(rowCount: number) {
    return Math.max(1, rowCount) * STRIP_ROW_REM;
  }

  public descriptionOf(appointment: Appointment<TimelineEntry>) {
    const entry = appointment.extra;

    return entry?.kind === 'row' ? entry.row.description : null;
  }

  /**
   * Read off the clock rather than off the index, because a day may start at a configured hour: on a
   * day that starts at 04:00 the first row of the axis is 04:00, not midnight. See ADR 0015.
   */
  protected labelFor(hour: number) {
    return `${String(new Date(this.focusedDate().getTime() + hour * HOUR_MS).getHours()).padStart(2, '0')}:00`;
  }

  protected kindOf(appointment: Appointment<TimelineEntry>) {
    return appointment.extra?.kind ?? 'row';
  }

  protected rowOf(appointment: Appointment<TimelineEntry>) {
    return rowEntryOf(appointment)?.row ?? null;
  }

  protected marks(appointment: Appointment<TimelineEntry>) {
    const row = this.rowOf(appointment);

    return !!row && this.isMarked(row);
  }

  protected splitInHalf(row: ReviewedRow) {
    this.rowSplit.emit({ row, at: new Date((row.from.getTime() + row.to.getTime()) / 2) });
  }

  protected dragging(appointment: Appointment<TimelineEntry>) {
    return this.scheduler().appointmentDrag()?.appointment.id === appointment.id;
  }

  /**
   * Opens the band's edit surface, anchored to the band itself.
   *
   * A press that moved the block is a drag and not a click on it — see {@link startDrag}. A press on
   * a story opens the first row under it, because a story is a grouping and carries nothing to edit.
   */
  protected select(appointment: Appointment<TimelineEntry>, event: Event) {
    if (this.hasDragged) return;

    const entry = appointment.extra;
    const origin = event.currentTarget as HTMLElement;

    if (entry?.kind === 'row' && withModifier(event)) {
      this.toggleMark(entry.row);

      return;
    }

    this.marked.set(new Set());

    if (entry?.kind === 'row') this.openFor(entry.row, origin);
    else if (entry?.kind === 'story') this.openFirstUnder(entry.issueKey, origin);
  }

  public isMarked(row: ReviewedRow) {
    return this.marked().has(row.id);
  }

  protected mergeMarked() {
    const rows = this.markedRows();

    if (rows.length < 2) return;

    this.marked.set(new Set());
    this.rowsMerge.emit(rows);
  }

  /** Moves a row to another time, or drags one of its ends. */
  protected startDrag(options: { event: PointerEvent; appointment: Appointment<TimelineEntry>; column: HTMLElement }) {
    const { event, appointment, column } = options;
    const entry = appointment.extra;

    // a press on a block must not also draw a fresh range down the column underneath it
    event.stopPropagation();
    this.hasDragged = false;

    if (entry?.kind !== 'row' || event.button !== 0) return;

    const scheduler = this.scheduler();
    const drag: RowDrag = {
      row: entry.row,
      mode: this.modeAt({ event, appointment }),
      grabMs: this.instantAt({ column, clientY: event.clientY }).getTime(),
    };

    const track = (gesture: DragGestureEvent) => {
      switch (gesture.type) {
        case 'start':
        case 'move': {
          this.hasDragged = true;

          if (!scheduler.appointmentDrag()) scheduler.beginAppointmentDrag(appointment, drag.mode);

          const at = this.instantAt({ column, clientY: gesture.data.clientY });
          const { from, to } = this.draggedRange(drag, at);

          return scheduler.updateAppointmentDrag(from, to);
        }
        case 'end':
          return scheduler.commitAppointmentDrag();
        // A tap moved nothing, and a cancelled gesture is a position nobody chose.
        case 'tapped':
        case 'cancelled':
          return scheduler.clearAppointmentDrag();
      }
    };

    dragGestureFrom(event, event.currentTarget as HTMLElement)
      .pipe(tap(track), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /**
   * Draws a range on empty grid. A press that never moves still draws one, so a click asks for a row
   * just as a drag does — the surface it opens is where the duration is corrected anyway.
   */
  protected startDraw(options: { event: PointerEvent; column: HTMLElement; lane: DayLane }) {
    const { event, column, lane } = options;

    if (event.button !== 0 || lane.key === BREAK_LANE_KEY) return;

    this.drawLane.set(lane.key);

    const scheduler = this.scheduler();
    const at = (clientY: number) => this.instantAt({ column, clientY });

    const track = (gesture: DragGestureEvent) => {
      switch (gesture.type) {
        case 'start':
        case 'move':
          return scheduler.draftRange()
            ? scheduler.extendDraftRange(at(gesture.data.clientY), SNAP_MS)
            : scheduler.beginDraftRange(at(gesture.data.clientY), DEFAULT_DRAFT_MS);
        case 'end':
        case 'tapped':
          return this.settleDraw();
        case 'cancelled':
          this.drawLane.set(null);

          return scheduler.clearDraftRange();
      }
    };

    dragGestureFrom(event, column).pipe(tap(track), takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected draggingBoundary(boundary: TimelineBoundary) {
    return this.boundaryDrag()?.boundary.id === boundary.id;
  }

  protected instantOf(boundary: TimelineBoundary) {
    const drag = this.boundaryDrag();

    return drag?.boundary.id === boundary.id ? drag.at : boundary.before.to;
  }

  protected clockOf(boundary: TimelineBoundary) {
    return formatClockTime(this.instantOf(boundary));
  }

  protected labelOf(boundary: TimelineBoundary) {
    const named = (row: ReviewedRow) => row.issueKey ?? UNNAMED_LABEL;

    return `Boundary between ${named(boundary.before)} and ${named(boundary.after)}`;
  }

  protected percentOf(at: Date) {
    return ((at.getTime() - this.focusedDate().getTime()) / DAY_MS) * 100;
  }

  protected minutesOf(ms: number) {
    return Math.round((ms - this.focusedDate().getTime()) / 60_000);
  }

  /** How far the boundary may travel. One step has to stay on each side, or a row would vanish. */
  protected limitsOf(boundary: TimelineBoundary) {
    return { min: boundary.before.from.getTime() + SNAP_MS, max: boundary.after.to.getTime() - SNAP_MS };
  }

  protected startBoundaryDrag(options: { event: PointerEvent; boundary: TimelineBoundary; column: HTMLElement }) {
    const { event, boundary, column } = options;

    // a press on the handle is neither a press on the block under it nor a range drawn on the column
    event.stopPropagation();

    const instantAt = (clientY: number) =>
      this.clamped(boundary, this.instantAt({ column, clientY, snap: false }).getTime());

    const track = (gesture: DragGestureEvent) => {
      switch (gesture.type) {
        case 'start':
        case 'move':
          return this.boundaryDrag.set({ boundary, at: instantAt(gesture.data.clientY) });
        case 'end':
          return this.settleBoundary(boundary, instantAt(gesture.data.clientY));
        case 'tapped':
        case 'cancelled':
          return this.boundaryDrag.set(null);
      }
    };

    dragGestureFrom(event, event.currentTarget as HTMLElement)
      .pipe(tap(track), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected nudge(event: KeyboardEvent, boundary: TimelineBoundary) {
    const step = event.key === 'ArrowUp' ? -SNAP_MS : event.key === 'ArrowDown' ? SNAP_MS : 0;

    if (!step) return;

    event.preventDefault();
    this.settleBoundary(boundary, this.clamped(boundary, boundary.before.to.getTime() + step));
  }

  /** The scheduler's own report of a finished drag, turned into the edit the day review applies. */
  protected reschedule(move: SchedulerAppointmentReschedule<TimelineEntry>) {
    const entry = move.previous.extra;

    if (entry?.kind === 'row') {
      this.rowReschedule.emit({ row: entry.row, from: move.appointment.start, to: move.appointment.end });
    }
  }

  private toggleMark(row: ReviewedRow) {
    this.marked.update((ids) => {
      const next = new Set(ids);

      if (!next.delete(row.id)) next.add(row.id);

      return next;
    });
  }

  private openFor(row: ReviewedRow, origin: HTMLElement) {
    this.surface.openRow({ row, origin, appointments: this.appointments() });
  }

  /** The first row under a story, so pressing the band opens something rather than nothing. */
  private openFirstUnder(issueKey: string, origin: HTMLElement) {
    const [first] = [...this.rows()]
      .filter((row) => row.storyKey === issueKey)
      .sort((a, b) => a.from.getTime() - b.from.getTime());

    if (first) this.openFor(first, origin);
  }

  /** Whether the press landed near an end of the block, which resizes, or on its body, which moves it. */
  private modeAt(options: {
    event: PointerEvent;
    appointment: Appointment<TimelineEntry>;
  }): SchedulerAppointmentDragMode {
    const { top, height } = (options.event.currentTarget as HTMLElement).getBoundingClientRect();
    const edge = Math.min(height * EDGE_FRACTION, MAX_EDGE_PX);
    const offset = options.event.clientY - top;

    if (offset <= edge) return 'resize-start';
    if (offset >= height - edge) return 'resize-end';

    return 'move';
  }

  /** Where the drag puts the row: shifted whole, or with the end being held moved to the pointer. */
  private draggedRange(drag: RowDrag, at: Date) {
    const { row, mode } = drag;

    if (mode === 'resize-start') {
      const latest = row.to.getTime() - SNAP_MS;

      return { from: new Date(Math.min(at.getTime(), latest)), to: row.to };
    }

    if (mode === 'resize-end') {
      const earliest = row.from.getTime() + SNAP_MS;

      return { from: row.from, to: new Date(Math.max(at.getTime(), earliest)) };
    }

    const shift = at.getTime() - drag.grabMs;
    const from = this.snapped(row.from.getTime() + shift);

    return { from: new Date(from), to: new Date(from + (row.to.getTime() - row.from.getTime())) };
  }

  /**
   * Opens the add surface over the drawn range, then drops the range: the surface holds it from here,
   * and a range left behind would sit under the next press.
   */
  private settleDraw() {
    const scheduler = this.scheduler();
    const draft = scheduler.draftRange();

    this.drawLane.set(null);
    scheduler.clearDraftRange();

    if (draft) this.surface.openDraft({ from: draft.start, to: draft.end });
  }

  /** The instant a pointer sits at in the day column, on the increment a worklog is logged in. */
  private instantAt(options: { column: HTMLElement; clientY: number; snap?: boolean }) {
    const { top, height } = options.column.getBoundingClientRect();
    const fraction = Math.min(Math.max((options.clientY - top) / height, 0), 1);
    const ms = this.focusedDate().getTime() + fraction * DAY_MS;

    return new Date(options.snap === false ? ms : this.snapped(ms));
  }

  private snapped(ms: number) {
    return Math.round(ms / SNAP_MS) * SNAP_MS;
  }

  private clamped(boundary: TimelineBoundary, ms: number) {
    const { min, max } = this.limitsOf(boundary);

    return new Date(Math.min(Math.max(this.snapped(ms), min), max));
  }

  private settleBoundary(boundary: TimelineBoundary, at: Date) {
    this.boundaryDrag.set(null);

    if (at.getTime() !== boundary.before.to.getTime())
      this.boundaryMove.emit({ before: boundary.before, after: boundary.after, at });
  }
}
