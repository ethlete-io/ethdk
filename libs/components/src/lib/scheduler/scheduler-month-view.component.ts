import { NgComponentOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ProvideColorDirective, injectRenderer, injectStyleManager } from '@ethlete/core';
import { addDays, differenceInCalendarDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns';
import { MENU_IMPORTS } from '../menu';
import { SCHEDULER_FEATURE_HOST, SchedulerDirective, SchedulerMonthDayCell, SchedulerMonthDirective } from './headless';
import { startSchedulerDragGesture } from './headless/internals/scheduler-drag-gesture';
import {
  resolveSchedulerCellItemFocus,
  resolveSchedulerMonthKeyboardDate,
  schedulerCellItemOffset,
} from './headless/internals/scheduler-keyboard';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment } from './scheduler.types';

/** The default month grid: one day cell per day, appointments as one-line badges with a "+N more" overflow. */
@Component({
  selector: 'et-scheduler-month-view',
  templateUrl: './scheduler-month-view.component.html',
  styleUrl: './scheduler-month-view.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS, ProvideColorDirective, NgComponentOutlet],
  hostDirectives: [SchedulerMonthDirective],
  host: {
    class: 'et-scheduler-month-view',
    role: 'grid',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class SchedulerMonthViewComponent {
  private scheduler = inject(SchedulerDirective, { optional: true });
  protected month = inject(SchedulerMonthDirective);
  protected labels = injectSchedulerLabels();

  private featureHost = inject(SCHEDULER_FEATURE_HOST, { optional: true });
  private appointmentDrag = inject(SchedulerAppointmentDragDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  protected injector = inject(Injector);
  private renderer = injectRenderer();
  private weeksElement = viewChild.required<ElementRef<HTMLElement>>('weeks');
  private weekRows = viewChildren<ElementRef<HTMLElement>>('weekRow');
  private cells = viewChildren<ElementRef<HTMLElement>>('cell');
  private cellItems = viewChildren<ElementRef<HTMLElement>>('cellItem');
  public draftAnchor = viewChild<ElementRef<HTMLElement>>('draftAnchor');

  protected canDragAppointments = computed(() => this.appointmentDrag?.isEnabled() ?? false);

  protected focusedDate = linkedSignal(() => startOfDay(this.scheduler?.focusedDate() ?? new Date()));

  private flatCells = computed(() => this.month.weeks().flat());
  private cellItemCounts = computed(() => this.flatCells().map((cell) => this.itemCount(cell)));

  private hasDragged = false;

  constructor() {
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }

  protected badgeAdornments() {
    return this.featureHost?.badgeAdornments() ?? [];
  }

  protected weekdays() {
    return this.scheduler?.weekdays() ?? [];
  }

  protected dayLabel(date: Date) {
    const locale = this.scheduler?.effectiveLocale();

    return format(date, 'PPPP', locale ? { locale } : undefined);
  }

  protected isFocused(date: Date) {
    return isSameDay(date, this.focusedDate());
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;

    const cellIndex = this.cells().findIndex((cell) => cell.nativeElement === event.target);

    if (cellIndex !== -1) return this.handleCellKeydown(event, cellIndex);

    const itemIndex = this.cellItems().findIndex((item) => item.nativeElement === event.target);

    if (itemIndex !== -1) this.handleItemKeydown(event, itemIndex);
  }

  protected isSelected(appointment: Appointment) {
    return this.scheduler?.selectedAppointmentId() === appointment.id;
  }

  protected select(appointment: Appointment, element: HTMLElement | null = null) {
    // only a `pointerdown` sets this, and one always precedes the click it belongs to - which is why
    // the flag can live here and cannot go stale
    if (this.hasDragged) return;

    this.scheduler?.surfaceAnchor.set(element);
    this.scheduler?.selectedAppointmentId.set(appointment.id);
  }

  protected isDrafted(date: Date) {
    const draft = this.scheduler?.draftRange();

    return !!draft && date >= startOfDay(draft.start) && date <= draft.end;
  }

  protected isDragging(appointment: Appointment) {
    return this.scheduler?.appointmentDrag()?.appointment.id === appointment.id;
  }

  protected isDropTarget(date: Date) {
    const drag = this.scheduler?.appointmentDrag();

    return !!drag && date >= startOfDay(drag.start) && date <= drag.end;
  }

  protected startAppointmentDrag(event: PointerEvent, target: { appointment: Appointment; weeks: HTMLElement }) {
    // a press on a badge must not also draw a fresh range across the cells underneath it
    event.stopPropagation();

    const scheduler = this.scheduler;

    if (!scheduler || !this.canDragAppointments() || event.button !== 0) return;

    const { appointment, weeks } = target;
    const grab = this.dateAt(weeks, event);

    if (!grab) return;

    this.hasDragged = false;

    startSchedulerDragGesture({
      event,
      element: weeks,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX, clientY) => {
        this.hasDragged = true;

        if (!scheduler.appointmentDrag()) scheduler.beginAppointmentDrag(appointment, 'move');

        const to = this.dateAt(weeks, { clientX, clientY });

        if (!to) return;

        const days = differenceInCalendarDays(to, grab);

        scheduler.updateAppointmentDrag(addDays(appointment.start, days), addDays(appointment.end, days));
      },
      settle: () => scheduler.commitAppointmentDrag(),
      cancel: () => scheduler.clearAppointmentDrag(),
    });
  }

  protected startDraftRange(event: PointerEvent, weeks: HTMLElement) {
    const scheduler = this.scheduler;

    if (!scheduler || event.button !== 0) return;

    const anchor = this.dateAt(weeks, event);

    if (!anchor) return;

    startSchedulerDragGesture({
      event,
      element: weeks,
      renderer: this.renderer,
      destroyRef: this.destroyRef,
      track: (clientX, clientY) => {
        const to = this.dateAt(weeks, { clientX, clientY }) ?? anchor;
        const [from, until] = to < anchor ? [to, anchor] : [anchor, to];

        scheduler.setDraftRange({ start: startOfDay(from), end: endOfDay(until), allDay: true });
      },
      settle: () => {
        const draft = scheduler.draftRange();

        if (!draft && !scheduler.selectedAppointmentId()) {
          scheduler.setDraftRange({ start: startOfDay(anchor), end: endOfDay(anchor), allDay: true });
        } else if (draft?.phase !== 'dragging') {
          return;
        }

        this.openDraftSurface(scheduler, weeks);
      },
      cancel: () => scheduler.clearDraftRange(),
    });
  }

  private handleCellKeydown(event: KeyboardEvent, cellIndex: number) {
    const cell = this.flatCells()[cellIndex];

    if (!cell) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      const hasItems = (this.cellItemCounts()[cellIndex] ?? 0) > 0;

      if (event.key === 'Enter' && hasItems) {
        this.cellItems()[schedulerCellItemOffset(this.cellItemCounts(), cellIndex)]?.nativeElement.focus();
      } else {
        this.createAppointmentOn(cell.date);
      }

      return;
    }

    const scheduler = this.scheduler;

    if (!scheduler) return;

    const target = resolveSchedulerMonthKeyboardDate(event.key, {
      focusedDate: cell.date,
      weekStartsOn: scheduler.effectiveFirstDayOfWeek(),
    });

    if (!target) return;

    event.preventDefault();
    this.focusedDate.set(target);

    const { start, end } = scheduler.visibleRange();

    if (target < start || target > end) scheduler.focusedDate.set(target);

    afterNextRender(() => this.focusRovingCell(), { injector: this.injector });
  }

  private handleItemKeydown(event: KeyboardEvent, itemIndex: number) {
    const target = resolveSchedulerCellItemFocus(event.key, {
      itemCounts: this.cellItemCounts(),
      flatIndex: itemIndex,
    });

    if (!target) return;

    event.preventDefault();

    const refs = target.kind === 'cell' ? this.cells() : this.cellItems();

    refs[target.index]?.nativeElement.focus();
  }

  private focusRovingCell() {
    const index = this.flatCells().findIndex((cell) => this.isFocused(cell.date));

    this.cells()[index]?.nativeElement.focus();
  }

  private createAppointmentOn(date: Date) {
    const scheduler = this.scheduler;

    if (!scheduler || scheduler.draftRange() || scheduler.selectedAppointmentId()) return;

    scheduler.setDraftRange({ start: startOfDay(date), end: endOfDay(date), allDay: true });
    this.openDraftSurface(scheduler, this.weeksElement().nativeElement);
  }

  private openDraftSurface(scheduler: SchedulerDirective, weeks: HTMLElement) {
    scheduler.surfaceAnchor.set(this.coverDraftRange(weeks));
    scheduler.commitDraftRange();
  }

  private itemCount(cell: SchedulerMonthDayCell) {
    return cell.visible.length + (cell.overflow.length > 0 ? 1 : 0);
  }

  private coverDraftRange(weeks: HTMLElement): HTMLElement | null {
    const anchor = this.draftAnchor()?.nativeElement;
    const rows = this.month.weeks();
    const rowIndex = rows.findIndex((week) => week.some((cell) => this.isDrafted(cell.date)));
    const row = rows[rowIndex];

    if (!anchor || !row) return null;

    const offset = rows.slice(0, rowIndex).reduce((count, week) => count + week.length, 0);
    const drafted = row
      .map((cell, index) => (this.isDrafted(cell.date) ? this.cells()[offset + index]?.nativeElement : null))
      .filter((element) => !!element)
      .map((element) => element.getBoundingClientRect());

    if (!drafted.length) return null;

    const host = weeks.getBoundingClientRect();
    const left = Math.min(...drafted.map((rect) => rect.left));
    const top = Math.min(...drafted.map((rect) => rect.top));

    this.renderer.setStyle(anchor, {
      left: `${left - host.left}px`,
      top: `${top - host.top}px`,
      width: `${Math.max(...drafted.map((rect) => rect.right)) - left}px`,
      height: `${Math.max(...drafted.map((rect) => rect.bottom)) - top}px`,
    });

    return anchor;
  }

  private dateAt(weeks: HTMLElement, at: { clientX: number; clientY: number }): Date | null {
    const rows = this.weekRows();
    const weekIndex = rows.findIndex((row) => {
      const { top, bottom } = row.nativeElement.getBoundingClientRect();

      return at.clientY >= top && at.clientY <= bottom;
    });

    const week = this.month.weeks()[weekIndex];

    if (!week) return null;

    const { left, width } = weeks.getBoundingClientRect();
    const column = Math.min(Math.max(Math.floor(((at.clientX - left) / width) * 7), 0), 6);

    return week[column]?.date ?? null;
  }
}
