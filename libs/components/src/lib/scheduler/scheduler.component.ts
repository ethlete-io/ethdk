import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, output, untracked } from '@angular/core';
import { randomId, signalHostElementDimensions, mountVisuallyHidden } from '@ethlete/core';
import { addHours, format, isSameDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { FLOATING_ACTION_IMPORTS } from '../floating-action';
import { LabelDirective, SEGMENTED_BUTTON_IMPORTS } from '../forms';
import { CALENDAR_ICON, CHEVRON_ICON, IconDirective, PLUS_ICON, provideIcons } from '../icon';
import {
  createSchedulerRegistry,
  SCHEDULER_FEATURE_HOST,
  SchedulerBadgeAdornment,
  SchedulerDirective,
  SchedulerFeatureHost,
  SchedulerToolbarAction,
} from './headless';
import { SchedulerActionAddAppointmentDirective } from './scheduler-action-add-appointment.directive';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerAppointmentDragDirective } from './scheduler-appointment-drag.directive';
import { SchedulerBadgeChainCountDirective } from './scheduler-badge-chain-count.directive';
import { SchedulerBadgeColorDotDirective } from './scheduler-badge-color-dot.directive';
import { SchedulerBadgeLocationDirective } from './scheduler-badge-location.directive';
import { SchedulerBadgeTimeRangeDirective } from './scheduler-badge-time-range.directive';
import { SchedulerBadgeTitleDirective } from './scheduler-badge-title.directive';
import { injectSchedulerEditSurfaceOpener } from './scheduler-edit-surface-opener';
import { SchedulerEditSurfaceResult } from './scheduler-edit-surface.token';
import { injectSchedulerLabels } from './scheduler-labels';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerSwipeNavigationDirective } from './scheduler-swipe-navigation.directive';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';
import { Appointment, AppointmentId, SchedulerDraftRange, SchedulerView } from './scheduler.types';

const NARROW_CONTAINER_WIDTH = 480;

@Component({
  selector: 'et-scheduler',
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    ...FLOATING_ACTION_IMPORTS,
    ...SEGMENTED_BUTTON_IMPORTS,
    LabelDirective,
    IconDirective,
    SchedulerAgendaViewComponent,
    SchedulerMonthViewComponent,
    SchedulerTimeGridViewComponent,
  ],
  providers: [
    provideIcons(CALENDAR_ICON, CHEVRON_ICON, PLUS_ICON),
    { provide: SCHEDULER_FEATURE_HOST, useExisting: SchedulerComponent },
  ],
  hostDirectives: [
    {
      directive: SchedulerDirective,
      inputs: [
        'appointments',
        'view',
        'focusedDate',
        'selectedAppointmentId',
        'locale',
        'firstDayOfWeek',
        'agendaDays',
        'businessHours',
        'nowIndicator',
      ],
      outputs: ['viewChange', 'focusedDateChange', 'selectedAppointmentIdChange', 'appointmentReschedule'],
    },
    { directive: SchedulerBadgeColorDotDirective, inputs: ['etSchedulerBadgeColorDot'] },
    { directive: SchedulerBadgeTitleDirective, inputs: ['etSchedulerBadgeTitle'] },
    { directive: SchedulerBadgeTimeRangeDirective, inputs: ['etSchedulerBadgeTimeRange'] },
    { directive: SchedulerBadgeLocationDirective, inputs: ['etSchedulerBadgeLocation'] },
    { directive: SchedulerBadgeChainCountDirective, inputs: ['etSchedulerBadgeChainCount'] },
    { directive: SchedulerActionAddAppointmentDirective, inputs: ['etSchedulerActionAddAppointment'] },
    { directive: SchedulerSwipeNavigationDirective, inputs: ['etSchedulerSwipeNavigation'] },
    { directive: SchedulerAppointmentDragDirective, inputs: ['etSchedulerAppointmentDrag'] },
  ],
  host: {
    class: 'et-scheduler',
  },
})
export class SchedulerComponent implements SchedulerFeatureHost {
  private labels = injectSchedulerLabels();
  private editSurfaceOpener = injectSchedulerEditSurfaceOpener();

  /**
   * The headless directive behind this scheduler - everything `[etScheduler]` exposes, for chrome
   * of your own around or instead of the default toolbar (`<et-scheduler #s>` then `s.headless`).
   */
  public headless = inject(SchedulerDirective);

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Emits the edited or newly-added appointment once the edit surface saves. */
  public appointmentSave = output<Appointment>();

  /** Emits every id to remove once the edit surface deletes a chain. */
  public appointmentsDelete = output<readonly AppointmentId[]>();

  private dimensions = signalHostElementDimensions();

  protected isNarrow = computed(() => (this.dimensions().client?.width ?? Infinity) < NARROW_CONTAINER_WIDTH);

  public previousLabel = computed(() => this.labels().previous);
  public nextLabel = computed(() => this.labels().next);
  public todayLabel = computed(() => this.labels().today);
  public switchViewLabel = computed(() => this.labels().switchView);
  public monthViewLabel = computed(() => this.labels().month);
  public weekViewLabel = computed(() => this.labels().week);
  public dayViewLabel = computed(() => this.labels().day);
  public agendaViewLabel = computed(() => this.labels().agenda);

  public headerLabel = computed(() => {
    const locale = this.headless.effectiveLocale();
    const options = locale ? { locale } : undefined;
    const view = this.headless.view();

    if (view === 'day') {
      return format(this.headless.focusedDate(), 'PPPP', options);
    }

    if (view === 'week' || view === 'agenda') {
      const { start, end } = this.headless.visibleRange();

      return new Intl.DateTimeFormat(locale?.code, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(
        start,
        end,
      );
    }

    return format(this.headless.focusedDate(), 'LLLL yyyy', options);
  });

  private badgeAdornmentRegistry = createSchedulerRegistry<SchedulerBadgeAdornment>();
  private toolbarActionRegistry = createSchedulerRegistry<SchedulerToolbarAction>();

  private openEditSurfaceToken: object | null = null;

  // Which selection the edit surface has already acted on. Compared by id, not by appointment
  // identity: an immutable `appointments` replacement gives the selected appointment a new object
  // every time, and re-opening on that stacks a second surface over the open one.
  private handledSelectionId: AppointmentId | null = null;

  private openedDraftRange: SchedulerDraftRange | null = null;

  constructor() {
    mountVisuallyHidden();

    this.headless.createEnabled.set(this.editSurfaceOpener.available);

    effect(() => {
      const appointment = this.headless.selectedAppointment();

      if (!appointment || appointment.id === this.handledSelectionId) {
        return;
      }

      untracked(() => this.openEditSurface(appointment.id));
    });

    effect(() => {
      const draft = this.headless.draftRange();

      if (draft?.phase !== 'committed') {
        return;
      }

      untracked(() => this.openDraftSurface(draft));
    });
  }

  public badgeAdornments() {
    return this.badgeAdornmentRegistry.entries();
  }

  public toolbarActions() {
    return this.toolbarActionRegistry.entries();
  }

  public setView(value: unknown) {
    this.headless.view.set(value as SchedulerView);
  }

  /**
   * Synthesizes a brand-new, blank top-level appointment - anchored to `focusedDate` so it lands
   * in whatever period is currently in view, defaulting to the next hour if that's today, else a
   * business-hours 9am - and opens the edit surface for it. Run by the built-in
   * `etSchedulerActionAddAppointment` toolbar action; call directly to trigger the same flow from
   * your own UI (`<et-scheduler #s>` then `s.addAppointment()`).
   */
  public addAppointment() {
    const day = startOfDay(this.headless.focusedDate());
    const hour = isSameDay(day, new Date()) ? Math.min(23, new Date().getHours() + 1) : 9;
    const start = setMinutes(setHours(day, hour), 0);

    this.openAddSurface({ id: randomId(), parentId: null, title: '', start, end: addHours(start, 1) });
  }

  public canAddAppointment() {
    return this.editSurfaceOpener.available;
  }

  public get element(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  public get appointmentTree() {
    return this.headless.appointmentTree;
  }

  public get selectedAppointment() {
    return this.headless.selectedAppointment;
  }

  public appointments(): readonly Appointment[] {
    return this.headless.visibleAppointments();
  }

  public registerBadgeAdornment(adornment: SchedulerBadgeAdornment) {
    this.badgeAdornmentRegistry.register(adornment);
  }

  public registerToolbarAction(action: SchedulerToolbarAction) {
    this.toolbarActionRegistry.register(action);
  }

  /**
   * Selects an appointment and opens the registered edit surface for it, anchored to whatever the
   * view registered for the interaction. Runs for you whenever `selectedAppointmentId` changes to
   * an appointment the surface is not already open for; call it to re-open the surface for the
   * appointment that is already selected, or to open one from your own UI. Without
   * `provideSchedulerEditSurface()` it only selects the appointment.
   */
  public openEditSurface(id: AppointmentId) {
    const appointment = untracked(this.headless.appointments).find((candidate) => candidate.id === id);

    if (!appointment) {
      return;
    }

    this.handledSelectionId = id;
    this.headless.selectedAppointmentId.set(id);

    if (!this.editSurfaceOpener.available) {
      this.headless.surfaceAnchor.set(null);

      return;
    }

    const surface = {};

    this.openEditSurfaceToken = surface;
    this.editSurfaceOpener.openEdit({
      appointment,
      appointments: this.headless.appointments,
      origin: this.takeSurfaceAnchor(),
      afterClosed: (result) => this.handleEditSurfaceClosed(surface, result),
    });
  }

  /** Closes the open edit surface without saving, clearing `selectedAppointmentId` back to `null`. */
  public closeEditSurface() {
    this.editSurfaceOpener.close();
  }

  /**
   * Selects an appointment without opening the edit surface - for highlighting one from a sidebar
   * or a list of your own. Writing `selectedAppointmentId` directly always opens the surface.
   */
  public selectAppointment(id: AppointmentId | null) {
    this.handledSelectionId = id;
    this.headless.selectedAppointmentId.set(id);
  }

  private openAddSurface(appointment: Appointment) {
    this.editSurfaceOpener.openAdd({
      appointment,
      appointments: this.headless.appointments,
      afterClosed: (result) => this.handleEditSurfaceResult(result),
    });
  }

  private openDraftSurface(draft: SchedulerDraftRange) {
    if (!this.editSurfaceOpener.available) {
      this.editSurfaceOpener.openEdit({ appointment: this.appointmentFromDraft(draft) });
      this.headless.clearDraftRange();

      return;
    }

    this.openedDraftRange = draft;

    this.editSurfaceOpener.openEdit({
      appointment: this.appointmentFromDraft(draft),
      appointments: this.headless.appointments,
      origin: this.takeSurfaceAnchor(),
      afterClosed: (result) => {
        // the close is animated, so a range drawn while it plays out is already the next surface's
        if (this.headless.draftRange() === this.openedDraftRange) {
          this.headless.clearDraftRange();
        }

        this.handleEditSurfaceResult(result);
      },
    });
  }

  private appointmentFromDraft(draft: SchedulerDraftRange): Appointment {
    return { id: randomId(), parentId: null, title: '', start: draft.start, end: draft.end, allDay: draft.allDay };
  }

  private takeSurfaceAnchor() {
    const anchor = this.headless.surfaceAnchor();

    this.headless.surfaceAnchor.set(null);

    return anchor;
  }

  private handleEditSurfaceClosed(surface: object, result: SchedulerEditSurfaceResult | null | undefined) {
    if (surface !== this.openEditSurfaceToken) {
      this.emitEditSurfaceResult(result);

      return;
    }

    this.openEditSurfaceToken = null;
    this.handleEditSurfaceResult(result);
  }

  private handleEditSurfaceResult(result: SchedulerEditSurfaceResult | null | undefined) {
    this.emitEditSurfaceResult(result);

    this.handledSelectionId = null;
    this.headless.selectedAppointmentId.set(null);
  }

  private emitEditSurfaceResult(result: SchedulerEditSurfaceResult | null | undefined) {
    if (result?.kind === 'save') {
      this.appointmentSave.emit(result.appointment);
    } else if (result?.kind === 'delete') {
      this.appointmentsDelete.emit(result.ids);
    }
  }
}
