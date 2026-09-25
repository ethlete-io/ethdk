import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Appointment,
  BUTTON_IMPORTS,
  MENU_IMPORTS,
  SCHEDULER_IMPORTS,
  SchedulerAppointmentDragMode,
  SchedulerAppointmentReschedule,
  SchedulerDirective,
  SchedulerTimeGridDirective,
  countDescendants,
} from '@ethlete/components';
import { DragGestureEvent, ProvideColorDirective, dragGestureFrom } from '@ethlete/core';
import {
  BehindStretch,
  BreakWindow,
  DEFAULT_ROUND_OPTIONS,
  ReviewedRow,
  TimeWindow,
  formatDurationMs,
} from '@ethlete/timetrack';
import { debounceTime, filter, fromEvent, map, merge, tap } from 'rxjs';
import { TimelineScroll, dayKeyOfDate, readViewState, rememberTimelineScroll } from '../view-state';
import { formatClockTime } from './format';
import {
  BREAK_LANE_KEY,
  BreakBand,
  DayLane,
  LaneBlock,
  NO_LANE_KEY,
  lanesOf,
  laneKeyOfRow,
  worktreeColumnOf,
} from './lanes';
import {
  TimelineEntry,
  appointmentLabel,
  appointmentOf,
  behindLabel,
  isStandInAppointment,
  rowEntryOf,
  unbookedLabel,
  unnamedLabelOf,
} from './row-edit/row-appointment';
import { rowActionsFor } from './row-edit/row-actions';
import { injectRowEditSurface } from './row-edit/row-edit-surface';
import { injectDayReview } from './day-review';
import { injectTimetrackSettings } from '../settings/settings';
import { injectGitCollector } from '../../collectors';

const markIntentOf = (event: Event) => {
  if (!(event instanceof MouseEvent)) return 'open';
  if (event.shiftKey) return 'extend';

  return event.ctrlKey || event.metaKey ? 'toggle' : 'open';
};

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

/** The least a block can be and still hold a padded line of text. */
const LABEL_MIN_REM = 2.2;

/**
 * The least a block can be and still hold a label at all. One increment is 2rem at `HOUR_REM`, which
 * fits a single unpadded line and nothing more - and every row is at least one increment wide, so a
 * quarter-hour band reads as itself rather than as a bar the pointer has to hover to identify.
 */
const COMPACT_MIN_REM = 1.9;

/** Two lines of text plus the block's own padding. Below this the description would clip mid-line. */
const DETAIL_MIN_REM = 5;

/** How tall one row of the all-day strip is, and the least it reserves when nothing is in it. */
const STRIP_ROW_REM = 2;

/**
 * The least a lane narrows to. A checkout's directory name has to stay readable, so a day of many
 * checkouts scrolls sideways rather than shrinking every lane to a sliver.
 */
const LANE_MIN_REM = 14;
const FULL_SPAN = { inlineOffset: 0, inlineSize: 100 };

/** How wide the break lane is. It carries no ticket and no gesture, so it stays narrow. */
const BREAK_LANE_REM = 6;

/** `span` is a percentage of the day, so this is the height a block renders at, in rem. */
const remOf = (span: number) => (span / 100) * 24 * HOUR_REM;

const HOUR_MS = 60 * 60_000;
const SCROLL_REMEMBER_DEBOUNCE_MS = 200;

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

type Marking = {
  ids: ReadonlySet<string>;
  /** The row an extend measures its run from: the last one a modifier-click marked. */
  anchor: string | null;
};

const NOTHING_MARKED: Marking = { ids: new Set(), anchor: null };

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
      class="relative flex min-h-0 grow flex-col"
      etScheduler
      view="day"
    >
      @if (markedCount(); as count) {
        <div
          class="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-et-surface-border bg-et-surface-bg px-3 py-2 text-small shadow-lg"
          data-marked-bar
        >
          <span>{{ count }} marked for a merge</span>

          @if (count > 1) {
            <button (click)="mergeMarked()" et-button variant="outline" size="sm">Merge into one row</button>
          }

          <button (click)="clearMarks()" et-button variant="transparent" size="sm">Clear</button>
        </div>
      }

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
                  [style]="{ height: '1.6rem' }"
                  (click)="select(entry.node.appointment, $event)"
                  class="absolute flex cursor-pointer items-center gap-2 truncate rounded-sm border-l-2 border-l-et-theme bg-et-theme/10 px-2 text-left text-small outline-none hover:bg-et-theme/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink"
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

            @if (grid.currentTime(); as currentTime) {
              <div
                [style.top.%]="currentTime.offset"
                class="pointer-events-none absolute right-0 left-13 z-10 border-t-2 border-t-et-brand-ink"
                data-now
                role="presentation"
              >
                <span class="absolute -top-1 -left-1 size-2 rounded-full bg-et-brand-ink"></span>
              </div>
            }

            <div class="absolute inset-y-0 right-0 left-13 flex">
              @for (lane of lanes(); track lane.key) {
                <div
                  #column
                  [attr.data-drawable]="drawable(lane) || null"
                  [style.flexGrow]="growOf(lane)"
                  [style.minWidth.rem]="minRemOf(lane)"
                  (pointerdown)="startDraw({ event: $event, column, lane })"
                  class="relative basis-0 touch-none border-l border-et-surface-border data-[drawable]:cursor-cell"
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
                    <button
                      [style.top.%]="band.offset"
                      [style.height.%]="band.span"
                      [title]="breakTitle(band)"
                      [attr.data-compact]="compact(band.span) || null"
                      (click)="breakClear.emit(band.window)"
                      (pointerdown)="$event.stopPropagation()"
                      class="absolute inset-x-0 flex flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border bg-et-surface-interaction px-2 py-1 text-left text-small text-et-surface-muted hover:border-et-surface-border-strong hover:text-et-surface-ink data-[compact]:py-0 data-[compact]:leading-none"
                      data-break
                      type="button"
                    >
                      @if (labelled(band.span)) {
                        <span class="block truncate">{{ breakLabel(band) }}</span>
                      }
                    </button>
                  }

                  @for (band of lane.behind; track band.stretch.from) {
                    <div
                      [style.top.%]="band.offset"
                      [style.height.%]="band.span"
                      [title]="BEHIND_LABEL_OF(band.stretch)"
                      [attr.data-compact]="compact(band.span) || null"
                      class="absolute inset-x-0 flex flex-col overflow-hidden rounded-sm border border-dashed border-et-surface-border bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,var(--color-et-surface-border)_6px,var(--color-et-surface-border)_7px)] px-2 py-1 text-small text-et-surface-muted data-[compact]:py-0 data-[compact]:leading-none"
                      data-behind
                    >
                      @if (labelled(band.span)) {
                        <span class="block truncate">{{ BEHIND_LABEL_OF(band.stretch) }}</span>
                      }
                    </div>
                  }

                  @for (laid of lane.blocks; track laid.block.node.appointment.id) {
                    <div
                      [attr.data-kind]="kindOf(laid.block.node.appointment)"
                      [attr.data-compact]="compact(laid.block.span) || null"
                      [attr.data-dragging]="dragging(laid.block.node.appointment) || null"
                      [attr.data-excluded]="excluded(laid.block.node.appointment) || null"
                      [attr.data-marked]="marks(laid.block.node.appointment) || null"
                      [attr.data-stand-in]="STANDS_IN(laid.block.node.appointment) || null"
                      [etProvideColor]="laid.block.node.appointment.colorToken ?? 'neutral'"
                      [style.top.%]="laid.block.offset"
                      [style.height.%]="laid.block.span"
                      [style.left.%]="laid.inlineOffset"
                      [style.width.%]="laid.inlineSize"
                      [style.clipPath]="laid.clipPath"
                      [style.paddingInlineStart]="insetOf(laid).start"
                      [style.paddingInlineEnd]="insetOf(laid).end"
                      [title]="LABEL_OF(laid.block.node.appointment) + UNBOOKED_OF(laid.block.node.appointment)"
                      (pointerdown)="
                        startDrag({ event: $event, appointment: laid.block.node.appointment, column, lane })
                      "
                      (click)="select(laid.block.node.appointment, $event)"
                      (keydown.enter)="select(laid.block.node.appointment, $event)"
                      class="absolute flex cursor-grab touch-none flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small outline-none hover:bg-et-theme/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink data-[compact]:py-0 data-[compact]:leading-none data-[dragging]:opacity-70 data-[excluded]:cursor-cell data-[marked]:ring-2 data-[marked]:ring-et-theme-ink data-[marked]:ring-inset data-[stand-in]:border-dashed"
                      etMenu
                      etMenuContextTrigger
                      role="button"
                      tabindex="0"
                    >
                      @if (rowOf(laid.block.node.appointment); as row) {
                        @if (isMarked(row)) {
                          <span class="sr-only">Marked for a merge</span>
                        }

                        <ng-template etMenuSurface>
                          <et-menu>
                            @for (action of actionsFor(row); track action.order) {
                              <button
                                [variant]="action.destructive ? 'destructive' : 'default'"
                                (click)="action.run()"
                                et-menu-item
                                type="button"
                              >
                                {{ action.label }}
                              </button>
                            }

                            @if (isMarked(row) && markedCount() > 1) {
                              <et-menu-separator />
                              <button (click)="mergeMarked()" et-menu-item type="button">
                                Merge the {{ markedCount() }} marked rows
                              </button>
                            }
                          </et-menu>
                        </ng-template>
                      }

                      <!-- These carry the resize cursor over the zone modeAt reads as an end, and nothing
                      else: the press is handled on the band, so they must let it through. A band a rule
                      excluded resizes nowhere, so it shows neither. -->
                      @if (!excluded(laid.block.node.appointment)) {
                        <span
                          [style.height.%]="EDGE_PERCENT"
                          [style.maxHeight.px]="MAX_EDGE_PX"
                          class="absolute inset-x-0 top-0 cursor-ns-resize"
                        ></span>
                        <span
                          [style.height.%]="EDGE_PERCENT"
                          [style.maxHeight.px]="MAX_EDGE_PX"
                          class="absolute inset-x-0 bottom-0 cursor-ns-resize"
                        ></span>
                      }

                      @for (segment of indentedIn(laid); track segment.from) {
                        <span
                          [style.top.%]="segment.from * 100"
                          [style.height.%]="(segment.to - segment.from) * 100"
                          [style.left.%]="((segment.inlineOffset - laid.inlineOffset) / laid.inlineSize) * 100"
                          class="pointer-events-none absolute w-0.5 bg-et-theme"
                          data-segment-edge
                        ></span>
                      }

                      @for (held of breaksIn(laid.block.node.appointment); track held.offset) {
                        <span
                          [style.top.%]="held.offset"
                          [style.height.%]="held.span"
                          class="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_5px,var(--color-et-surface-muted)_5px,var(--color-et-surface-muted)_6px)]"
                          data-break-overlap
                        ></span>
                      }

                      @for (swap of swapsIn(laid.block.node.appointment); track swap.offset) {
                        <span
                          [style.top.%]="swap.offset"
                          [title]="swap.detail"
                          class="absolute inset-x-0 border-t border-dashed border-t-et-theme"
                          data-swap
                        ></span>
                      }

                      @if (labelled(laid.block.span)) {
                        <span class="block truncate">
                          {{ LABEL_OF(laid.block.node.appointment) }}
                          @if (UNBOOKED_OF(laid.block.node.appointment); as unbooked) {
                            <span class="text-et-surface-muted" data-unbooked>{{ unbooked }}</span>
                          }
                        </span>
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
                      [style.left.%]="spanOf({ lane, boundary }).inlineOffset"
                      [style.width.%]="spanOf({ lane, boundary }).inlineSize"
                      [attr.data-dragging]="draggingBoundary(boundary) || null"
                      (keydown)="nudge($event, boundary)"
                      (pointerdown)="startBoundaryDrag({ event: $event, boundary, column })"
                      class="group absolute -mt-1 flex h-2 cursor-ns-resize touch-none items-center outline-none"
                      aria-orientation="horizontal"
                      role="separator"
                      tabindex="0"
                    >
                      <span
                        class="h-0.5 grow rounded-full bg-et-surface-subtle opacity-40 group-hover:bg-et-theme group-hover:opacity-100 group-focus-visible:bg-et-theme group-focus-visible:opacity-100 group-active:bg-et-theme group-active:opacity-100 group-data-[dragging]:bg-et-theme group-data-[dragging]:opacity-100"
                      ></span>
                      <span
                        class="absolute top-1/2 right-0 -translate-y-1/2 rounded-sm bg-et-surface-interaction px-1 text-mono whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 group-data-[dragging]:opacity-100"
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
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, ProvideColorDirective, SCHEDULER_IMPORTS],
  host: { class: 'flex min-h-0 flex-col', '(keydown.escape)': 'clearMarks()' },
})
export class DayTimelineComponent {
  private destroyRef = inject(DestroyRef);
  private surface = injectRowEditSurface();
  private store = injectDayReview();
  private settings = injectTimetrackSettings();
  private git = injectGitCollector();

  public focusedDate = input.required<Date>();
  public rows = input.required<readonly ReviewedRow[]>();
  /** The day's breaks, as the rows leave them. They get a lane of their own, and no gesture. */
  public breaks = input<readonly BreakWindow[]>([]);
  /**
   * The stretches a foreground band took from a background band. Drawn in the lane they ran in, so a
   * lane's hole says which band holds its minutes instead of saying nothing.
   */
  public behind = input<readonly BehindStretch[]>([]);

  /** Where two adjacent rows should meet instead. */
  public boundaryMove = output<BoundaryMove>();
  /** Where a row was dragged to, whole or by one end. */
  public rowReschedule = output<RowReschedule>();

  /** A break the reviewer pressed, which says they were at the machine for the stretch it covered. */
  public breakClear = output<TimeWindow>();

  /** A range the reviewer drew in the break lane, which says they were away for that stretch. */
  public breakDraw = output<TimeWindow>();

  private body = viewChild.required<ElementRef<HTMLElement>>('body');
  private dayColumn = viewChild<ElementRef<HTMLElement>>('dayColumn');
  public grid = viewChild(SchedulerTimeGridDirective);
  private scheduler = viewChild.required<SchedulerDirective<TimelineEntry>>(SchedulerDirective);

  private scrollDay = computed(() => dayKeyOfDate(this.focusedDate()));
  private scrollTarget = linkedSignal<string, TimelineScroll | 'first-band' | null>({
    source: this.scrollDay,
    computation: (day) => readViewState().timelineScroll?.[day] ?? 'first-band',
  });

  /**
   * The bands marked for a merge. A plain click anywhere on a band clears them, and so does a step to
   * another day: the ids belong to one day's rows and name nothing on the next.
   */
  private marking = linkedSignal<Date, Marking>({ source: this.focusedDate, computation: () => NOTHING_MARKED });

  /** The instant a boundary is being dragged to, until the pointer settles on it. */
  private boundaryDrag = signal<{ boundary: TimelineBoundary; at: Date } | null>(null);

  /** Whether the press now ending moved a block rather than being a click on it. */
  private hasDragged = false;

  /** Which lane a range is being drawn in, so the draft is previewed there and nowhere else. */
  private drawLane = signal<string | null>(null);

  protected readonly HOUR_REM = HOUR_REM;
  protected readonly STRIP_ROW_REM = STRIP_ROW_REM;
  protected readonly EDGE_PERCENT = EDGE_FRACTION * 100;
  protected readonly MAX_EDGE_PX = MAX_EDGE_PX;
  protected readonly HOURS = Array.from({ length: 25 }, (_, hour) => hour);
  protected readonly COUNT_DESCENDANTS = countDescendants;
  protected readonly LABEL_OF = appointmentLabel;
  protected readonly BEHIND_LABEL_OF = behindLabel;
  protected readonly UNBOOKED_OF = unbookedLabel;
  protected readonly STANDS_IN = isStandInAppointment;

  /** The day as one lane per checkout. The grid supplies the vertical geometry; the lane the inline. */
  private columnOf = computed(() => worktreeColumnOf(this.git.worktrees()));

  protected lanes = computed<DayLane[]>(() =>
    lanesOf({
      blocks: this.grid()?.days()[0]?.blocks ?? [],
      breaks: this.breaks(),
      behind: this.behind(),
      dayStart: this.focusedDate(),
      columnOf: this.columnOf(),
    }),
  );

  /**
   * The pairs of rows that meet at one instant, by the lane they are in. A pair of two increments
   * gets no handle: `limitsOf` then puts the boundary's only legal instant where it already is.
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
        if (after.to.getTime() - before.from.getTime() < 3 * SNAP_MS) return [];

        return [{ id: `${before.id}|${after.id}`, before, after }];
      });
    };

    const columnOf = this.columnOf();
    const byColumn = new Map<string, TimelineBoundary[]>();

    for (const [key, rows] of rowsByLane) {
      const column = columnOf(key);

      byColumn.set(column, [...(byColumn.get(column) ?? []), ...boundariesOf(rows)]);
    }

    return byColumn;
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

  /** Every stand-in by id, so a band naming one reads its name without walking the list per redraw. */
  private standInNames = computed(
    () => new Map(this.settings.settings().standIns.map((standIn) => [standIn.id, standIn.name])),
  );

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
          standInName: this.standInNameOf(row),
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
    const { ids } = this.marking();

    return this.rows()
      .filter((row) => ids.has(row.id))
      .sort((a, b) => a.from.getTime() - b.from.getTime());
  });

  protected markedCount = computed(() => this.markedRows().length);

  constructor() {
    /**
     * A day opens where it was left, or else an hour before its first band: a 24-hour grid opened at
     * midnight shows an empty screen. A reload renders the grid before the day's rows arrive, and a
     * scroller without its lanes clamps the sideways offset to zero, so the target is applied again on
     * every render until the rows are drawn, and no scroll is remembered before that.
     */
    afterRenderEffect(() => {
      const target = this.scrollTarget();

      if (!target) return;

      const body = this.body().nativeElement;

      if (target === 'first-band') {
        const hours = this.dayColumn()?.nativeElement;

        if (!hours) return;

        // `offsetTop` is measured against a shared offset parent, so the difference is where the hour
        // axis starts inside the scroller — the all-day strip above it is exactly what that accounts for.
        body.scrollTop = hours.offsetTop - body.offsetTop + (hours.offsetHeight / 24) * this.scrollHour();
      } else {
        body.scrollTo(target);
      }

      if (this.rows().length) this.scrollTarget.set(null);
    });

    afterNextRender(() => {
      const body = this.body().nativeElement;

      // eslint-disable-next-line ethlete/prefer-scroll-state
      fromEvent(body, 'scroll')
        .pipe(
          filter(() => !this.scrollTarget()),
          map(() => this.scrollDay()),
          debounceTime(SCROLL_REMEMBER_DEBOUNCE_MS),
          tap((day) => rememberTimelineScroll(day, { top: body.scrollTop, left: body.scrollLeft })),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();

      merge(fromEvent(body, 'wheel'), fromEvent(body, 'pointerdown'), fromEvent(body, 'keydown'))
        .pipe(
          tap(() => this.scrollTarget.set(null)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
    });
  }

  protected labelled(span: number) {
    return remOf(span) >= COMPACT_MIN_REM;
  }

  /** Whether the block has to give up its padding to fit the one line it gets. */
  protected compact(span: number) {
    return remOf(span) < LABEL_MIN_REM;
  }

  protected detailed(span: number) {
    return remOf(span) >= DETAIL_MIN_REM;
  }

  /**
   * Keeps the label inside the block's first segment. A padding percent is read off the lane's width,
   * which is the unit the segments are measured in.
   */
  protected insetOf(laid: LaneBlock) {
    const first = laid.segments[0];

    if (!first || !laid.clipPath) return { start: null, end: null };

    const start = first.inlineOffset - laid.inlineOffset;
    const end = laid.inlineOffset + laid.inlineSize - first.inlineOffset - first.inlineSize;
    // A border-box grows past its width once the padding outgrows it, and the percent clip path then
    // cuts the grown box, so a narrow segment spilled into the column beside it.
    const gap = `clamp(0px, ${first.inlineSize / 2}% - 1px, var(--spacing) * 2)`;

    return {
      start: `calc(${start}% + ${gap})`,
      end: `calc(${end}% + ${gap})`,
    };
  }

  protected indentedIn(laid: LaneBlock) {
    return laid.segments.filter((segment) => segment.inlineOffset > laid.inlineOffset);
  }

  /** Whether a press on the lane draws a range. Every lane does: the break lane draws a break. */
  protected drawable(lane: DayLane) {
    return !!lane;
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

  /**
   * Where a band's own checkout swapped branch, as a percent of the band's height. The instant is the
   * one the swap was observed at, while the band is drawn on the increment its row snapped to, so the
   * mark says where the work changed hands and not where a row starts.
   */
  protected swapsIn(appointment: Appointment<TimelineEntry>) {
    const row = this.rowOf(appointment);
    const span = row ? row.to.getTime() - row.from.getTime() : 0;

    if (!row || span <= 0) return [];

    return row.evidence
      .filter((entry) => entry.kind === 'branch-swap')
      .map((entry) => ({ detail: entry.detail, offset: ((entry.at.getTime() - row.from.getTime()) / span) * 100 }))
      .filter((swap) => swap.offset > 0 && swap.offset < 100);
  }

  /**
   * Where a break crosses a band, as a percent of the band's height. A break an agent ran through
   * leaves no gap between the rows, so its own lane draws it beside the band rather than in it; this
   * marks the same window on the band that books the time.
   */
  protected breaksIn(appointment: Appointment<TimelineEntry>) {
    const row = this.rowOf(appointment);
    const span = row ? row.to.getTime() - row.from.getTime() : 0;

    if (!row || span <= 0) return [];

    return this.breaks()
      .map((window) => {
        const from = Math.max(window.from.getTime(), row.from.getTime());
        const to = Math.min(window.to.getTime(), row.to.getTime());

        return { offset: ((from - row.from.getTime()) / span) * 100, span: ((to - from) / span) * 100 };
      })
      .filter((held) => held.span > 0);
  }

  protected marks(appointment: Appointment<TimelineEntry>) {
    const row = this.rowOf(appointment);

    return !!row && this.isMarked(row);
  }

  /** Whether a rule excluded this band, which is what makes the press on it draw rather than drag. */
  protected excluded(appointment: Appointment<TimelineEntry>) {
    return !!this.rowOf(appointment)?.excluded;
  }

  /** What a band's own context menu offers, which is the list the edit surface offers as well. */
  protected actionsFor(row: ReviewedRow) {
    return rowActionsFor({ store: this.store, row, rows: this.rows() });
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

    if (entry?.kind === 'row') {
      const intent = markIntentOf(event);

      if (intent === 'toggle') return this.toggleMark(entry.row);
      if (intent === 'extend') return this.extendMark(entry.row);
    }

    this.clearMarks();

    if (entry?.kind === 'row') this.openFor(entry.row, origin);
    else if (entry?.kind === 'story') this.openFirstUnder(entry.issueKey, origin);
  }

  protected isMarked(row: ReviewedRow) {
    return this.marking().ids.has(row.id);
  }

  protected clearMarks() {
    this.marking.set(NOTHING_MARKED);
  }

  protected mergeMarked() {
    const rows = this.markedRows();

    if (rows.length < 2) return;

    this.clearMarks();
    this.store.mergeRows(rows);
  }

  /**
   * Moves a row to another time, or drags one of its ends.
   *
   * A press on a band a rule excluded draws a range over it instead. That band's clock is the
   * microphone's and not the reviewer's, so neither end of it is theirs to move; what they can say is
   * that some of those minutes were work, and drawing the row over it is how they say it. The row
   * then cuts the band — see `addManualRow`.
   */
  protected startDrag(options: {
    event: PointerEvent;
    appointment: Appointment<TimelineEntry>;
    column: HTMLElement;
    lane: DayLane;
  }) {
    const { event, appointment, column, lane } = options;
    const entry = appointment.extra;

    // a press on a block must not also draw a fresh range down the column underneath it
    event.stopPropagation();
    this.hasDragged = false;

    if (entry?.kind !== 'row' || event.button !== 0) return;
    if (entry.row.excluded) return this.startDraw({ event, column, lane });

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

    if (event.button !== 0 || !this.drawable(lane)) return;

    this.drawLane.set(lane.key);

    const scheduler = this.scheduler();
    const at = (clientY: number) => this.instantAt({ column, clientY });

    const track = (gesture: DragGestureEvent) => {
      switch (gesture.type) {
        case 'start':
        case 'move':
          // A range drawn over a band ends in a click on that band. Without this, the band's own edit
          // surface would open over the add surface the drawn range just asked for.
          this.hasDragged = true;

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

  protected spanOf(options: { lane: DayLane; boundary: TimelineBoundary }) {
    const segmentOf = (id: string, edge: 'first' | 'last') => {
      const laid = options.lane.blocks.find((block) => rowEntryOf(block.block.node.appointment)?.row.id === id);

      return edge === 'first' ? laid?.segments[0] : laid?.segments.at(-1);
    };

    const before = segmentOf(options.boundary.before.id, 'last') ?? FULL_SPAN;
    const after = segmentOf(options.boundary.after.id, 'first') ?? FULL_SPAN;
    const start = Math.max(before.inlineOffset, after.inlineOffset);
    const end = Math.min(before.inlineOffset + before.inlineSize, after.inlineOffset + after.inlineSize);

    return end > start ? { inlineOffset: start, inlineSize: end - start } : before;
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
    const named = (row: ReviewedRow) => row.issueKey ?? unnamedLabelOf({ row, standInName: this.standInNameOf(row) });

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

  private standInNameOf(row: ReviewedRow) {
    return row.standInId ? this.standInNames().get(row.standInId) : undefined;
  }

  private toggleMark(row: ReviewedRow) {
    this.marking.update(({ ids }) => {
      const next = new Set(ids);

      if (!next.delete(row.id)) next.add(row.id);

      return { ids: next, anchor: next.has(row.id) ? row.id : null };
    });
  }

  /**
   * Marks the run of bands from the last one marked through the one clicked, inside the lane the two
   * share. Across two lanes the bands between them are another checkout's work, so a shift-click in
   * a lane the anchor is not in marks the band it landed on and nothing else.
   */
  private extendMark(row: ReviewedRow) {
    const { ids, anchor } = this.marking();
    const lane = this.rows()
      .filter((other) => laneKeyOfRow(other) === laneKeyOfRow(row))
      .sort((a, b) => a.from.getTime() - b.from.getTime());
    const from = lane.findIndex((other) => other.id === anchor);
    const to = lane.findIndex((other) => other.id === row.id);

    if (from === -1 || to === -1) return this.toggleMark(row);

    const run = lane.slice(Math.min(from, to), Math.max(from, to) + 1);

    this.marking.set({ ids: new Set([...ids, ...run.map((other) => other.id)]), anchor });
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
    const lane = this.drawLane();

    this.drawLane.set(null);
    scheduler.clearDraftRange();

    if (!draft) return;

    if (lane === BREAK_LANE_KEY) {
      this.breakDraw.emit({ from: draft.start, to: draft.end });

      return;
    }

    this.surface.openDraft({
      from: draft.start,
      to: draft.end,
      laneKey: lane && lane !== NO_LANE_KEY ? lane : undefined,
    });
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
