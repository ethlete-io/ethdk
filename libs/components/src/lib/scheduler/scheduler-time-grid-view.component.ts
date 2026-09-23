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
  linkedSignal,
  untracked,
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
  isSameDay,
  setHours,
  startOfDay,
} from 'date-fns';
import {
  SCHEDULER_FEATURE_HOST,
  SchedulerDirective,
  SchedulerTimeGridBlock,
  SchedulerTimeGridDirective,
} from './headless';
import { startSchedulerDragGesture } from './headless/internals/scheduler-drag-gesture';
import {
  SCHEDULER_TIME_GRID_ALL_DAY_ROW,
  SchedulerTimeGridKeyboardCell,
  resolveSchedulerCellItemFocus,
  resolveSchedulerTimeGridKeyboardCell,
  schedulerCellItemOffset,
} from './headless/internals/scheduler-keyboard';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { injectSchedulerLabels } from './scheduler-labels';
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

type SchedulerTimeGridCellGroup = {
  cells: readonly ElementRef<HTMLElement>[];
  items: readonly ElementRef<HTMLElement>[];
  itemCounts: readonly number[];
};

type SchedulerTimeGridRovingCell = { dayIndex: number; row: number };

const blockStartHour = (block: SchedulerTimeGridBlock) =>
  Math.min(Math.floor((block.offset / 100) * HOURS.length + 1e-6), HOURS.length - 1);

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
    '(keydown)': 'handleKeydown($event)',
  },
})
export class SchedulerTimeGridViewComponent {
  private scheduler = inject(SchedulerDirective, { optional: true });
  protected grid = inject(SchedulerTimeGridDirective);
  private labels = injectSchedulerLabels();

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private appointmentDrag = inject(SchedulerAppointmentDragDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostInjector = inject(Injector);
  private renderer = injectRenderer();
  public timeGridBody = viewChild<ElementRef<HTMLElement>>('timeGridBody');
  private firstHourRow = viewChild<ElementRef<HTMLElement>>('hourRow');
  private dayColumns = viewChildren<ElementRef<HTMLElement>>('dayColumn');
  public draftBlock = viewChild<ElementRef<HTMLElement>>('draftBlock');
  private slotCells = viewChildren<ElementRef<HTMLElement>>('slotCell');
  private slotItems = viewChildren<ElementRef<HTMLElement>>('slotItem');
  private allDayCellElements = viewChildren<ElementRef<HTMLElement>>('allDayCell');
  private allDayItems = viewChildren<ElementRef<HTMLElement>>('allDayItem');

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

  protected columns = computed(() => {
    const hours = this.hours();

    return this.grid.days().map((day) => {
      const dayLabel = this.dayLabel(day.date);

      return {
        day,
        slots: hours.map(({ hour, label }) => ({
          hour,
          label: `${dayLabel}, ${label}`,
          blocks: day.blocks.filter((block) => blockStartHour(block) === hour),
        })),
      };
    });
  });

  protected allDayCells = computed(() => {
    const days = this.grid.days();
    const entries = this.grid.allDay();
    const allDay = this.labels().allDay;

    return days.map((day, dayIndex) => ({
      date: day.date,
      label: `${this.dayLabel(day.date)}, ${allDay}`,
      entries: entries.filter((entry) => Math.round((entry.inlineOffset / 100) * days.length) === dayIndex),
    }));
  });

  protected focusedSlot = linkedSignal<Date, SchedulerTimeGridKeyboardCell>({
    source: () => startOfDay(this.scheduler?.focusedDate() ?? new Date()),
    computation: (day, previous) => ({
      day,
      row: previous?.value.row ?? untracked(() => this.grid.initialScrollHour()) + 1,
    }),
  });

  private rovingCell = computed<SchedulerTimeGridRovingCell>(() => {
    const { day, row } = this.focusedSlot();
    const hasAllDayRow = this.grid.allDayRowCount() > 0;

    return {
      dayIndex: this.grid.days().findIndex((column) => isSameDay(column.date, day)),
      row: row === SCHEDULER_TIME_GRID_ALL_DAY_ROW && !hasAllDayRow ? row + 1 : row,
    };
  });

  private slotGroup = computed<SchedulerTimeGridCellGroup>(() => ({
    cells: this.slotCells(),
    items: this.slotItems(),
    itemCounts: this.columns().flatMap((column) => column.slots.map((slot) => slot.blocks.length)),
  }));

  private allDayGroup = computed<SchedulerTimeGridCellGroup>(() => ({
    cells: this.allDayCellElements(),
    items: this.allDayItems(),
    itemCounts: this.allDayCells().map((cell) => cell.entries.length),
  }));

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

  protected cellTabIndex(dayIndex: number, row: number) {
    const roving = this.rovingCell();

    return roving.dayIndex === dayIndex && roving.row === row ? 0 : -1;
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;

    const slotIndex = this.slotCells().findIndex((cell) => cell.nativeElement === event.target);

    if (slotIndex !== -1) {
      return this.handleCellKeydown(event, {
        dayIndex: Math.floor(slotIndex / HOURS.length),
        row: (slotIndex % HOURS.length) + 1,
      });
    }

    const allDayIndex = this.allDayCellElements().findIndex((cell) => cell.nativeElement === event.target);

    if (allDayIndex !== -1) {
      return this.handleCellKeydown(event, { dayIndex: allDayIndex, row: SCHEDULER_TIME_GRID_ALL_DAY_ROW });
    }

    for (const group of [this.slotGroup(), this.allDayGroup()]) {
      const itemIndex = group.items.findIndex((item) => item.nativeElement === event.target);

      if (itemIndex !== -1) return this.handleItemKeydown(event, { ...group, itemIndex });
    }
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

        if (!draft) return this.draftHourFrom(this.draftTimeAt(column, event.clientY));
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

  private handleCellKeydown(event: KeyboardEvent, cell: SchedulerTimeGridRovingCell) {
    const scheduler = this.scheduler;
    const day = this.grid.days()[cell.dayIndex];

    if (!scheduler || !day) return;

    const isAllDay = cell.row === SCHEDULER_TIME_GRID_ALL_DAY_ROW;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      const group = isAllDay ? this.allDayGroup() : this.slotGroup();
      const flatIndex = isAllDay ? cell.dayIndex : cell.dayIndex * HOURS.length + cell.row - 1;

      if (event.key === 'Enter' && (group.itemCounts[flatIndex] ?? 0) > 0) {
        group.items[schedulerCellItemOffset(group.itemCounts, flatIndex)]?.nativeElement.focus();
      } else if (!isAllDay && !scheduler.draftRange()) {
        this.draftHourFrom(setHours(startOfDay(day.date), cell.row - 1));
      }

      return;
    }

    const target = resolveSchedulerTimeGridKeyboardCell(event.key, {
      focused: { day: day.date, row: cell.row },
      weekStartsOn: scheduler.effectiveFirstDayOfWeek(),
      view: scheduler.view() === 'day' ? 'day' : 'week',
      hasAllDayRow: this.grid.allDayRowCount() > 0,
    });

    if (!target) return;

    event.preventDefault();
    this.focusedSlot.set(target);

    const { start, end } = scheduler.visibleRange();

    if (target.day < start || target.day > end) scheduler.focusedDate.set(target.day);

    afterNextRender(() => this.focusRovingCell(), { injector: this.hostInjector });
  }

  private handleItemKeydown(event: KeyboardEvent, group: SchedulerTimeGridCellGroup & { itemIndex: number }) {
    const target = resolveSchedulerCellItemFocus(event.key, {
      itemCounts: group.itemCounts,
      flatIndex: group.itemIndex,
    });

    if (!target) return;

    event.preventDefault();

    const refs = target.kind === 'cell' ? group.cells : group.items;

    refs[target.index]?.nativeElement.focus();
  }

  private focusRovingCell() {
    const { dayIndex, row } = this.rovingCell();
    const cell =
      row === SCHEDULER_TIME_GRID_ALL_DAY_ROW
        ? this.allDayCellElements()[dayIndex]
        : this.slotCells()[dayIndex * HOURS.length + row - 1];

    cell?.nativeElement.focus();
  }

  private dayLabel(date: Date) {
    const locale = this.scheduler?.effectiveLocale();

    return format(date, 'PPPP', locale ? { locale } : undefined);
  }

  private draftHourFrom(at: Date) {
    const scheduler = this.scheduler;

    if (!scheduler || scheduler.selectedAppointmentId()) return;

    scheduler.beginDraftRange(at, DEFAULT_DRAFT_DURATION);

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
