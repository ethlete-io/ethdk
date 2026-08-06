import { NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ProvideColorDirective, injectRenderer, injectStyleManager } from '@ethlete/core';
import { addMinutes, format, setHours, startOfDay } from 'date-fns';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerTimeGridDirective } from './headless';
import { startSchedulerDraftGesture } from './headless/internals/scheduler-draft-gesture';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { Appointment } from './scheduler.types';

const HOURS = /* @__PURE__ */ Array.from({ length: 24 }, (_, hour) => hour);

const MINUTES_PER_DAY = 24 * 60;
const DRAFT_SLOT_MINUTES = 15;
const DRAFT_MINIMUM_DURATION = DRAFT_SLOT_MINUTES * 60 * 1000;

type SchedulerDraftColumn = { element: HTMLElement; day: Date };

/**
 * The default time grid: an hour axis, an all-day strip, and appointments packed into
 * overlap-free columns. Backs both the week and day views - the day view is this same component
 * with a one-day visible range, not a separate implementation.
 */
@Component({
  selector: 'et-scheduler-time-grid-view',
  templateUrl: './scheduler-time-grid-view.component.html',
  styleUrl: './scheduler-time-grid-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective, NgComponentOutlet],
  hostDirectives: [SchedulerTimeGridDirective],
  host: {
    class: 'et-scheduler-time-grid-view',
  },
})
export class SchedulerTimeGridViewComponent {
  protected scheduler = inject(SchedulerDirective, { optional: true });
  protected grid = inject(SchedulerTimeGridDirective);

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private destroyRef = inject(DestroyRef);
  private renderer = injectRenderer();
  protected timeGridBody = viewChild<ElementRef<HTMLElement>>('timeGridBody');
  private firstHourRow = viewChild<ElementRef<HTMLElement>>('hourRow');
  public draftBlock = viewChild<ElementRef<HTMLElement>>('draftBlock');

  protected hours = computed(() => {
    const locale = this.scheduler?.effectiveLocale();
    const reference = startOfDay(new Date());

    return HOURS.map((hour) => ({
      hour,
      label: format(setHours(reference, hour), 'HH:mm', locale ? { locale } : undefined),
    }));
  });

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);

    // Once per mount, not reactively - re-scrolling on every `focusedDate` change would yank a
    // user's own scroll position back every time they step to the next day/week.
    afterNextRender(() => {
      const body = this.timeGridBody()?.nativeElement;
      const hourRow = this.firstHourRow()?.nativeElement;

      if (!body || !hourRow) {
        return;
      }

      body.scrollTop = this.grid.initialScrollHour() * hourRow.offsetHeight;
    });
  }

  /** UI contributed by badge features (title, time range, …) - see `registerBadgeAdornment`. */
  protected badgeAdornments() {
    return this.featureHost?.badgeAdornments() ?? [];
  }

  protected weekdayLabel(date: Date) {
    const locale = this.scheduler?.effectiveLocale();

    return format(date, 'EEE', locale ? { locale } : undefined);
  }

  protected isSelected(appointment: Appointment) {
    return this.scheduler?.selectedAppointmentId() === appointment.id;
  }

  protected select(appointment: Appointment, element: HTMLElement) {
    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }

  /**
   * Drags a new appointment's time range out of an empty part of a day column. With a mouse the
   * gesture's own commit threshold separates a drag from a click, so tapping empty grid does
   * nothing; a finger has to long-press first - see `startSchedulerDraftGesture`.
   */
  protected startDraftRange(event: PointerEvent, column: SchedulerDraftColumn) {
    const scheduler = this.scheduler;

    if (!scheduler || event.button !== 0) return;

    startSchedulerDraftGesture({
      event,
      element: column.element,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      draw: (_, clientY) => {
        const at = this.draftTimeAt(column, clientY);

        return scheduler.draftRange()
          ? scheduler.extendDraftRange(at, DRAFT_MINIMUM_DURATION)
          : scheduler.beginDraftRange(at, DRAFT_MINIMUM_DURATION);
      },
      settle: () => {
        if (!scheduler.draftRange()) return;

        // the preview is what the create surface anchors to, so hand it over before committing
        scheduler.surfaceAnchor.set(this.draftBlock()?.nativeElement ?? null);
        scheduler.commitDraftRange();
      },
      cancel: () => scheduler.clearDraftRange(),
    });
  }

  /** The time a pointer at `clientY` sits at in `column`, snapped to the draft's slot size. */
  private draftTimeAt(column: SchedulerDraftColumn, clientY: number) {
    const { top, height } = column.element.getBoundingClientRect();
    const fraction = Math.min(Math.max((clientY - top) / height, 0), 1);
    const snapped = Math.round((fraction * MINUTES_PER_DAY) / DRAFT_SLOT_MINUTES) * DRAFT_SLOT_MINUTES;

    return addMinutes(startOfDay(column.day), Math.min(snapped, MINUTES_PER_DAY));
  }
}
