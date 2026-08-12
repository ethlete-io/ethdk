import {
  Component,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Appointment, SCHEDULER_IMPORTS, SchedulerTimeGridDirective } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { ActivityBlock, Confidence, ReviewedRow, blockDurationMs, formatDurationMs } from '@ethlete/timetrack';
import { formatBlockLabel } from './format';

/** What a timeline block stands for, so a click knows whether there is a row behind it. */
export type TimelineEntry = { kind: 'row'; row: ReviewedRow } | { kind: 'block' };

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

@Component({
  selector: 'ethlete-day-timeline',
  template: `
    <div [appointments]="appointments()" [focusedDate]="focusedDate()" etScheduler view="day">
      <div #body #grid="etSchedulerTimeGrid" class="max-h-160 overflow-y-auto" etSchedulerTimeGrid>
        @for (day of grid.days(); track day.date.getTime()) {
          <div [style.height.rem]="24 * HOUR_REM" class="relative">
            @for (hour of HOURS; track hour) {
              <div [style.top.rem]="hour * HOUR_REM" class="absolute inset-x-0 flex items-center gap-2">
                <span class="w-11 shrink-0 text-right text-mono text-et-surface-subtle">{{ labelFor(hour) }}</span>
                <span class="h-px grow bg-et-surface-border"></span>
              </div>
            }

            <div class="absolute inset-y-0 right-0 left-13">
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
                  class="absolute overflow-hidden rounded-sm border-l-2 border-l-et-theme px-2 py-px text-left text-small data-[kind=block]:bg-et-surface-interaction/8 data-[kind=row]:bg-et-theme/15"
                  type="button"
                >
                  @if (labelled(block.span)) {
                    <span class="block truncate">{{ block.node.appointment.title }}</span>
                  }
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, SCHEDULER_IMPORTS],
})
export class DayTimelineComponent {
  public focusedDate = input.required<Date>();
  public rows = input.required<readonly ReviewedRow[]>();
  /** The blocks nothing could attribute. Shown behind the rows, because the time was still spent. */
  public unattributed = input.required<readonly ActivityBlock[]>();

  /** The row behind a block the reviewer clicked, so the list can open it. */
  public rowSelect = output<ReviewedRow>();

  private body = viewChild.required<ElementRef<HTMLElement>>('body');
  public grid = viewChild.required(SchedulerTimeGridDirective);

  protected readonly HOUR_REM = HOUR_REM;
  protected readonly HOURS = Array.from({ length: 25 }, (_, hour) => hour);

  /**
   * The day as appointments. A row carries its confidence's theme; an unattributed block carries none,
   * so the two never read as the same kind of thing.
   */
  protected appointments = computed<Appointment<TimelineEntry>[]>(() => [
    ...this.unattributed().map((block, index): Appointment<TimelineEntry> => ({
      id: `block:${index}`,
      parentId: null,
      title: `${formatBlockLabel(block)} · ${formatDurationMs(blockDurationMs(block))}`,
      start: block.from,
      end: block.to,
      extra: { kind: 'block' },
    })),
    ...this.rows().map((row): Appointment<TimelineEntry> => ({
      id: row.id,
      parentId: null,
      title: `${row.issueKey} · ${formatDurationMs(row.durationMs)}`,
      start: row.from,
      end: row.to,
      colorToken: CONFIDENCE_THEME[row.confidence],
      extra: { kind: 'row', row },
    })),
  ]);

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
}
