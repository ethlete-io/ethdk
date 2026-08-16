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
import { Appointment, SCHEDULER_IMPORTS, SchedulerTimeGridDirective } from '@ethlete/components';
import { DragGestureEvent, ProvideColorDirective, dragGestureFrom } from '@ethlete/core';
import {
  ActivityBlock,
  Confidence,
  DEFAULT_ROUND_OPTIONS,
  ReviewedRow,
  blockDurationMs,
  formatDurationMs,
} from '@ethlete/timetrack';
import { tap } from 'rxjs';
import { formatBlockLabel, formatClockTime } from './format';

/** What a timeline block stands for, so a click knows whether there is a row behind it. */
export type TimelineEntry = { kind: 'row'; row: ReviewedRow } | { kind: 'block' };

/** Two rows that meet at one instant. Dragging that instant is what places a cut exactly. */
export type TimelineBoundary = { id: string; before: ReviewedRow; after: ReviewedRow };

export type BoundaryMove = { before: ReviewedRow; after: ReviewedRow; at: Date };

/**
 * The theme each confidence tier paints in. Registered theme names, not colours — the scheduler reads
 * `colorToken` as `[etProvideColor]`.
 */
const CONFIDENCE_THEME: Record<Confidence, string> = {
  certain: 'success',
  likely: 'brand',
  weak: 'warning',
};

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

const DAY_MS = 24 * 60 * 60_000;

/**
 * What a dragged boundary snaps to. The rounding increment and nothing finer: a row whose clock says
 * 09:07 but whose duration rounded to the quarter hour is claiming a precision it does not have.
 */
const SNAP_MS = DEFAULT_ROUND_OPTIONS.incrementMs;

@Component({
  selector: 'ethlete-day-timeline',
  template: `
    <div
      [appointments]="appointments()"
      [focusedDate]="focusedDate()"
      class="flex min-h-0 grow flex-col"
      etScheduler
      view="day"
    >
      <div #body #grid="etSchedulerTimeGrid" class="min-h-0 grow overflow-y-auto pb-6" etSchedulerTimeGrid>
        @for (day of grid.days(); track day.date.getTime()) {
          <div [style.height.rem]="24 * HOUR_REM" class="relative">
            @for (hour of HOURS; track hour) {
              <div [style.top.rem]="hour * HOUR_REM" class="absolute inset-x-0 flex items-center gap-2">
                <span class="w-11 shrink-0 text-right text-mono text-et-surface-subtle">{{ labelFor(hour) }}</span>
                <span class="h-px grow bg-et-surface-border"></span>
              </div>
            }

            <div #column class="absolute inset-y-0 right-0 left-13">
              @for (block of day.blocks; track block.node.appointment.id) {
                <button
                  [attr.data-kind]="kindOf(block.node.appointment)"
                  [etProvideColor]="block.node.appointment.colorToken ?? 'neutral'"
                  [style.top.%]="block.offset"
                  [style.height.%]="block.span"
                  [style.left.%]="block.inlineOffset"
                  [style.width.%]="block.inlineSize"
                  [title]="block.node.appointment.title"
                  (click)="select(block.node.appointment)"
                  class="absolute flex flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme px-2 py-1 text-left text-small data-[kind=block]:bg-et-surface-interaction/8 data-[kind=row]:bg-et-theme/15"
                  type="button"
                >
                  @if (labelled(block.span)) {
                    <span class="block truncate">{{ block.node.appointment.title }}</span>
                  }
                  @if (detailed(block.span) && descriptionOf(block.node.appointment); as description) {
                    <span class="block truncate text-et-surface-muted">{{ description }}</span>
                  }
                </button>
              }

              @for (boundary of boundaries(); track boundary.id) {
                <div
                  [attr.aria-label]="'Boundary between ' + boundary.before.issueKey + ' and ' + boundary.after.issueKey"
                  [attr.aria-valuemax]="minutesOf(limitsOf(boundary).max)"
                  [attr.aria-valuemin]="minutesOf(limitsOf(boundary).min)"
                  [attr.aria-valuenow]="minutesOf(instantOf(boundary).getTime())"
                  [attr.aria-valuetext]="clockOf(boundary)"
                  [style.top.%]="percentOf(instantOf(boundary))"
                  (keydown)="nudge($event, boundary)"
                  (pointerdown)="startDrag({ event: $event, boundary, column })"
                  class="group absolute inset-x-0 -mt-1 flex h-2 touch-none items-center outline-none"
                  aria-orientation="horizontal"
                  role="separator"
                  tabindex="0"
                >
                  <span
                    class="h-0.5 grow rounded-full bg-et-surface-subtle opacity-40 group-hover:opacity-100 group-focus-visible:opacity-100"
                  ></span>
                  <span
                    [style.opacity]="dragging(boundary) ? 1 : null"
                    class="ml-2 shrink-0 rounded-sm bg-et-surface-interaction px-1 text-mono opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >{{ clockOf(boundary) }}</span
                  >
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, SCHEDULER_IMPORTS],
  host: { class: 'flex min-h-0 flex-col' },
})
export class DayTimelineComponent {
  private destroyRef = inject(DestroyRef);

  public focusedDate = input.required<Date>();
  public rows = input.required<readonly ReviewedRow[]>();
  /** The blocks nothing could attribute. Shown behind the rows, because the time was still spent. */
  public unattributed = input.required<readonly ActivityBlock[]>();

  /** The row behind a block the reviewer clicked, so the list can open it. */
  public rowSelect = output<ReviewedRow>();
  /** Where two adjacent rows should meet instead. */
  public boundaryMove = output<BoundaryMove>();

  private body = viewChild.required<ElementRef<HTMLElement>>('body');
  public grid = viewChild.required(SchedulerTimeGridDirective);

  /** The instant a boundary is being dragged to, until the pointer settles on it. */
  private drag = signal<{ boundary: TimelineBoundary; at: Date } | null>(null);

  protected readonly HOUR_REM = HOUR_REM;
  protected readonly HOURS = Array.from({ length: 25 }, (_, hour) => hour);

  /**
   * The pairs of rows that meet at one instant, ordered by the clock. A pair too short to keep a step
   * on either side of its boundary gets no handle: there is nowhere left to drag it to.
   */
  protected boundaries = computed<TimelineBoundary[]>(() => {
    const ordered = [...this.rows()].sort((a, b) => a.from.getTime() - b.from.getTime());

    return ordered.flatMap((before, index) => {
      const after = ordered[index + 1];

      if (!after || before.to.getTime() !== after.from.getTime()) return [];
      if (after.to.getTime() - before.from.getTime() < 2 * SNAP_MS) return [];

      return [{ id: `${before.id}|${after.id}`, before, after }];
    });
  });

  /**
   * The day as appointments. A row carries its confidence's theme; an unattributed block carries none,
   * so the two never read as the same kind of thing. A boundary being dragged moves both of its rows
   * here, so the grid draws the cut where the pointer is rather than where it last settled.
   */
  protected appointments = computed<Appointment<TimelineEntry>[]>(() => {
    const drag = this.drag();

    return [
      ...this.unattributed().map((block, index): Appointment<TimelineEntry> => ({
        id: `block:${index}`,
        parentId: null,
        title: `${formatBlockLabel(block)} · ${formatDurationMs(blockDurationMs(block))}`,
        start: block.from,
        end: block.to,
        extra: { kind: 'block' },
      })),
      ...this.rows().map((row): Appointment<TimelineEntry> => {
        return {
          id: row.id,
          parentId: null,
          title: `${row.issueKey} · ${formatDurationMs(row.durationMs)}`,
          start: drag?.boundary.after.id === row.id ? drag.at : row.from,
          end: drag?.boundary.before.id === row.id ? drag.at : row.to,
          colorToken: CONFIDENCE_THEME[row.confidence],
          extra: { kind: 'row', row },
        };
      }),
    ];
  });

  constructor() {
    /**
     * Once, on mount: a 24-hour grid opened at midnight shows an empty screen. Scrolling on every
     * day change instead would yank the reviewer's own scroll position back each time they step a day.
     */
    afterNextRender(() => {
      const body = this.body().nativeElement;

      body.scrollTop = (body.scrollHeight / 24) * this.grid().initialScrollHour();
    });
  }

  /** `span` is a percentage of the day, so this is the height the block actually renders at. */
  protected labelled(span: number) {
    return (span / 100) * 24 * HOUR_REM >= LABEL_MIN_REM;
  }

  protected detailed(span: number) {
    return (span / 100) * 24 * HOUR_REM >= DETAIL_MIN_REM;
  }

  protected descriptionOf(appointment: Appointment<TimelineEntry>) {
    const entry = appointment.extra;

    return entry?.kind === 'row' ? entry.row.description : null;
  }

  protected labelFor(hour: number) {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  protected kindOf(appointment: Appointment<TimelineEntry>) {
    return appointment.extra?.kind ?? 'block';
  }

  protected select(appointment: Appointment<TimelineEntry>) {
    const entry = appointment.extra;

    if (entry?.kind === 'row') this.rowSelect.emit(entry.row);
  }

  protected dragging(boundary: TimelineBoundary) {
    return this.drag()?.boundary.id === boundary.id;
  }

  protected instantOf(boundary: TimelineBoundary) {
    const drag = this.drag();

    return drag?.boundary.id === boundary.id ? drag.at : boundary.before.to;
  }

  protected clockOf(boundary: TimelineBoundary) {
    return formatClockTime(this.instantOf(boundary));
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

  protected startDrag(options: { event: PointerEvent; boundary: TimelineBoundary; column: HTMLElement }) {
    const { event, boundary, column } = options;

    const instantAt = (clientY: number) => {
      const { top, height } = column.getBoundingClientRect();
      const fraction = Math.min(Math.max((clientY - top) / height, 0), 1);

      return this.clamped(boundary, this.focusedDate().getTime() + fraction * DAY_MS);
    };

    const track = (gesture: DragGestureEvent) => {
      switch (gesture.type) {
        case 'start':
        case 'move':
          return this.drag.set({ boundary, at: instantAt(gesture.data.clientY) });
        case 'end':
          return this.settle(boundary, instantAt(gesture.data.clientY));
        // A tap moved nothing, and a cancelled gesture is a position nobody chose.
        case 'tapped':
        case 'cancelled':
          return this.drag.set(null);
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
    this.settle(boundary, this.clamped(boundary, boundary.before.to.getTime() + step));
  }

  private clamped(boundary: TimelineBoundary, ms: number) {
    const { min, max } = this.limitsOf(boundary);

    return new Date(Math.min(Math.max(Math.round(ms / SNAP_MS) * SNAP_MS, min), max));
  }

  private settle(boundary: TimelineBoundary, at: Date) {
    this.drag.set(null);

    if (at.getTime() !== boundary.before.to.getTime())
      this.boundaryMove.emit({ before: boundary.before, after: boundary.after, at });
  }
}
