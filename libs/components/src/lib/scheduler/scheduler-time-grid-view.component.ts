import { NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ProvideColorDirective, injectRenderer, injectStyleManager } from '@ethlete/core';
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  setHours,
  startOfDay,
} from 'date-fns';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerTimeGridDirective } from './headless';
import { startSchedulerDragGesture } from './headless/internals/scheduler-drag-gesture';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { Appointment, SchedulerAppointmentDragMode } from './scheduler.types';

const HOURS = /* @__PURE__ */ Array.from({ length: 24 }, (_, hour) => hour);

const MINUTES_PER_DAY = 24 * 60;
const SLOT_MINUTES = 15;
const MINIMUM_DURATION = SLOT_MINUTES * 60 * 1000;
const DEFAULT_DRAFT_MINUTES = 60;
const DEFAULT_DRAFT_DURATION = DEFAULT_DRAFT_MINUTES * 60 * 1000;

type SchedulerTimeGridColumn = { element: HTMLElement; day: Date };

type SchedulerTimeGridDragTarget = {
  appointment: Appointment;
  mode: SchedulerAppointmentDragMode;
  column: SchedulerTimeGridColumn;
};

type SchedulerTimeGridDrag = SchedulerTimeGridDragTarget & {
  grabMinutes: number;
};

type SchedulerTimeGridAllDayDragTarget = {
  appointment: Appointment;
  mode: SchedulerAppointmentDragMode;
  lane: HTMLElement;
};

type SchedulerTimeGridAllDayDrag = Omit<SchedulerTimeGridAllDayDragTarget, 'lane'> & {
  grabDay: Date;
};

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
    role: 'grid',
  },
})
export class SchedulerTimeGridViewComponent {
  private scheduler = inject(SchedulerDirective, { optional: true });
  protected grid = inject(SchedulerTimeGridDirective);

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private appointmentDrag = inject(SchedulerAppointmentDragDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostInjector = inject(Injector);
  private renderer = injectRenderer();
  public timeGridBody = viewChild<ElementRef<HTMLElement>>('timeGridBody');
  private firstHourRow = viewChild<ElementRef<HTMLElement>>('hourRow');
  private dayColumns = viewChildren<ElementRef<HTMLElement>>('dayColumn');
  public draftBlock = viewChild<ElementRef<HTMLElement>>('draftBlock');

  protected canDragAppointments = computed(() => this.appointmentDrag?.isEnabled() ?? false);

  private hasDragged = false;

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

  protected isDragging(appointment: Appointment) {
    return this.scheduler?.appointmentDrag()?.appointment.id === appointment.id;
  }

  protected select(appointment: Appointment, element: HTMLElement) {
    // only a `pointerdown` sets this, and one always precedes the click it belongs to - which is why
    // the flag can live here and cannot go stale
    if (this.hasDragged) return;

    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }

  protected startAppointmentDrag(event: PointerEvent, target: SchedulerTimeGridDragTarget) {
    // a press on a block must not also draw a fresh range down the column underneath it
    event.stopPropagation();

    const scheduler = this.scheduler;

    if (!scheduler || !this.canDragAppointments() || event.button !== 0) return;

    const { appointment, mode, column } = target;
    const drag = { ...target, grabMinutes: this.minutesAt(column.element, event.clientY) };

    this.hasDragged = false;

    startSchedulerDragGesture({
      event,
      element: column.element,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX, clientY) => {
        this.hasDragged = true;

        if (!scheduler.appointmentDrag()) scheduler.beginAppointmentDrag(appointment, mode);

        const { start, end } =
          drag.mode === 'move' ? this.movedRange(drag, { clientX, clientY }) : this.resizedRange(drag, clientY);

        scheduler.updateAppointmentDrag(start, end);
      },
      settle: () => scheduler.commitAppointmentDrag(),
      cancel: () => scheduler.clearAppointmentDrag(),
    });
  }

  protected startAllDayDrag(event: PointerEvent, target: SchedulerTimeGridAllDayDragTarget) {
    // a press on an edge handle must not also start the entry moving
    event.stopPropagation();

    const scheduler = this.scheduler;

    if (!scheduler || !this.canDragAppointments() || event.button !== 0) return;

    const { appointment, mode, lane } = target;
    const grabDay = this.columnAt(event.clientX)?.day;

    if (!grabDay) return;

    const drag = { appointment, mode, grabDay };

    this.hasDragged = false;

    startSchedulerDragGesture({
      event,
      element: lane,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX) => {
        this.hasDragged = true;

        if (!scheduler.appointmentDrag()) scheduler.beginAppointmentDrag(appointment, mode);

        const to = this.columnAt(clientX)?.day;

        if (!to) return;

        const { start, end } = this.allDayRange(drag, to);

        scheduler.updateAppointmentDrag(start, end);
      },
      settle: () => scheduler.commitAppointmentDrag(),
      cancel: () => scheduler.clearAppointmentDrag(),
    });
  }

  protected startDraftRange(event: PointerEvent, column: SchedulerTimeGridColumn) {
    const scheduler = this.scheduler;

    if (!scheduler || event.button !== 0) return;

    startSchedulerDragGesture({
      event,
      element: column.element,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (_, clientY) => {
        const at = this.draftTimeAt(column, clientY);

        // the first unit is the full default: a long press released without moving has to land on
        // the same hour a click does, and the first drag move recomputes from the anchor anyway
        return scheduler.draftRange()
          ? scheduler.extendDraftRange(at, MINIMUM_DURATION)
          : scheduler.beginDraftRange(at, DEFAULT_DRAFT_DURATION);
      },
      settle: () => {
        const draft = scheduler.draftRange();

        if (!draft) return this.draftHourAt(column, event.clientY);
        if (draft.phase !== 'dragging') return;

        // the preview is what the create surface anchors to, so hand it over before committing
        scheduler.surfaceAnchor.set(this.draftBlock()?.nativeElement ?? null);
        scheduler.commitDraftRange();
      },
      cancel: () => scheduler.clearDraftRange(),
    });
  }

  private movedRange(drag: SchedulerTimeGridDrag, at: { clientX: number; clientY: number }) {
    const { appointment, column, grabMinutes } = drag;
    const target = this.columnAt(at.clientX) ?? column;
    const days = differenceInCalendarDays(target.day, column.day);
    const minutes = this.minutesAt(target.element, at.clientY) - grabMinutes;
    const start = this.snapToSlot(addMinutes(addDays(appointment.start, days), minutes));

    return { start, end: new Date(start.getTime() + (appointment.end.getTime() - appointment.start.getTime())) };
  }

  private resizedRange(drag: SchedulerTimeGridDrag, clientY: number) {
    const { appointment, column } = drag;
    const at = this.snapToSlot(addMinutes(startOfDay(column.day), this.minutesAt(column.element, clientY)));

    if (drag.mode === 'resize-start') {
      const latest = new Date(appointment.end.getTime() - MINIMUM_DURATION);

      return { start: at > latest ? latest : at, end: appointment.end };
    }

    const earliest = new Date(appointment.start.getTime() + MINIMUM_DURATION);

    return { start: appointment.start, end: at < earliest ? earliest : at };
  }

  private allDayRange(drag: SchedulerTimeGridAllDayDrag, to: Date) {
    const { appointment, mode, grabDay } = drag;
    const span = differenceInCalendarDays(appointment.end, appointment.start);

    switch (mode) {
      case 'resize-start': {
        const days = Math.min(differenceInCalendarDays(to, appointment.start), span);

        return { start: addDays(appointment.start, days), end: appointment.end };
      }
      case 'resize-end': {
        const days = Math.max(differenceInCalendarDays(to, appointment.end), -span);

        return { start: appointment.start, end: addDays(appointment.end, days) };
      }
      default: {
        const days = differenceInCalendarDays(to, grabDay);

        return { start: addDays(appointment.start, days), end: addDays(appointment.end, days) };
      }
    }
  }

  private columnAt(clientX: number): SchedulerTimeGridColumn | null {
    const columns = this.dayColumns();
    const index = columns.findIndex((column) => {
      const { left, right } = column.nativeElement.getBoundingClientRect();

      return clientX >= left && clientX <= right;
    });

    const element = columns[index]?.nativeElement;
    const day = this.grid.days()[index];

    return element && day ? { element, day: day.date } : null;
  }

  private draftHourAt(column: SchedulerTimeGridColumn, clientY: number) {
    const scheduler = this.scheduler;

    if (!scheduler || scheduler.selectedAppointmentId()) return;

    scheduler.beginDraftRange(this.draftTimeAt(column, clientY), DEFAULT_DRAFT_DURATION);

    afterNextRender(
      () => {
        scheduler.surfaceAnchor.set(this.draftBlock()?.nativeElement ?? null);
        scheduler.commitDraftRange();
      },
      { injector: this.hostInjector },
    );
  }

  private draftTimeAt(column: SchedulerTimeGridColumn, clientY: number) {
    return this.snapToSlot(addMinutes(startOfDay(column.day), this.minutesAt(column.element, clientY)));
  }

  private minutesAt(element: HTMLElement, clientY: number) {
    const { top, height } = element.getBoundingClientRect();

    return Math.min(Math.max((clientY - top) / height, 0), 1) * MINUTES_PER_DAY;
  }

  private snapToSlot(at: Date) {
    const dayStart = startOfDay(at);
    const minutes = differenceInMinutes(at, dayStart);

    return addMinutes(dayStart, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES);
  }
}
