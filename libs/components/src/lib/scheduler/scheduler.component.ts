import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  inputBinding,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError, randomId, signalHostElementDimensions } from '@ethlete/core';
import { addHours, format, isSameDay, isSameMonth, isSameYear, setHours, setMinutes, startOfDay } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { FLOATING_ACTION_IMPORTS } from '../floating-action';
import { LabelDirective, SEGMENTED_BUTTON_IMPORTS } from '../forms';
import { CALENDAR_ICON, CHEVRON_ICON, IconDirective, PLUS_ICON, provideIcons } from '../icon';
import { OverlayRef, createOverlayOpener } from '../overlay';
import {
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
import { SCHEDULER_EDIT_SURFACE, SchedulerEditSurfaceResult } from './scheduler-edit-surface.token';
import { SCHEDULER_ERROR_CODES } from './scheduler-errors';
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
  private editSurface = inject(SCHEDULER_EDIT_SURFACE, { optional: true });

  /**
   * The headless directive behind this scheduler - everything `[etScheduler]` exposes, for chrome
   * of your own around or instead of the default toolbar (`<et-scheduler #s>` then `s.headless`).
   */
  public headless = inject(SchedulerDirective);

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Emits the edited or newly-added appointment once the default edit surface saves. */
  public appointmentSave = output<Appointment>();

  /** Emits every id to remove once the default edit surface deletes a chain. */
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
      return format(this.headless.focusedDate(), 'EEEE, d MMMM yyyy', options);
    }

    if (view === 'week' || view === 'agenda') {
      const { start, end } = this.headless.visibleRange();

      if (isSameMonth(start, end)) {
        return `${format(start, 'd', options)} – ${format(end, 'd MMMM yyyy', options)}`;
      }

      if (isSameYear(start, end)) {
        return `${format(start, 'd MMMM', options)} – ${format(end, 'd MMMM yyyy', options)}`;
      }

      return `${format(start, 'd MMMM yyyy', options)} – ${format(end, 'd MMMM yyyy', options)}`;
    }

    return format(this.headless.focusedDate(), 'LLLL yyyy', options);
  });

  private badgeAdornmentList = signal<SchedulerBadgeAdornment[]>([]);

  public badgeAdornments = computed(() =>
    this.badgeAdornmentList()
      .filter((adornment) => adornment.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  private toolbarActionList = signal<SchedulerToolbarAction[]>([]);

  public toolbarActions = computed(() =>
    this.toolbarActionList()
      .filter((action) => action.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  private editSurfaceRef: OverlayRef<object, SchedulerEditSurfaceResult> | null = null;

  private editSurfaceOpener = this.editSurface
    ? createOverlayOpener(this.editSurface.editOverlay, {
        afterClosed: (result) => {
          this.editSurfaceRef = null;
          this.handleEditSurfaceResult(result);
        },
      })
    : null;

  // Which selection the edit surface has already acted on. Compared by id, not by appointment
  // identity: an immutable `appointments` replacement gives the selected appointment a new object
  // every time, and re-opening on that stacks a second surface over the open one.
  private handledSelectionId: AppointmentId | null = null;

  private addSurfaceOpener = this.editSurface
    ? createOverlayOpener(this.editSurface.addOverlay, {
        afterClosed: (result) => this.handleEditSurfaceResult(result),
      })
    : null;

  private openedDraftRange: SchedulerDraftRange | null = null;

  private draftSurfaceOpener = this.editSurface
    ? createOverlayOpener(this.editSurface.editOverlay, {
        afterClosed: (result) => {
          // the close is animated, so a range drawn while it plays out is already the next surface's
          if (this.headless.draftRange() === this.openedDraftRange) {
            this.headless.clearDraftRange();
          }

          this.handleEditSurfaceResult(result);
        },
      })
    : null;

  constructor() {
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
    this.badgeAdornmentList.update((list) => [...list, adornment]);
  }

  public registerToolbarAction(action: SchedulerToolbarAction) {
    this.toolbarActionList.update((list) => [...list, action]);
  }

  /**
   * Selects an appointment and opens the default edit surface for it, anchored to whatever the
   * view registered for the interaction. Runs for you whenever `selectedAppointmentId` changes to
   * an appointment the surface is not already open for; call it to re-open the surface for the
   * appointment that is already selected, or to open one from your own UI.
   */
  public openEditSurface(id: AppointmentId) {
    const appointment = untracked(this.headless.appointments).find((candidate) => candidate.id === id);

    if (!appointment) {
      return;
    }

    if (!this.editSurfaceOpener) {
      if (ngDevMode) {
        throw new RuntimeError(
          SCHEDULER_ERROR_CODES.EDIT_SURFACE_NOT_REGISTERED,
          '[Scheduler] An appointment was selected without the default edit surface. Add provideSchedulerEditSurface() to a parent injector.',
        );
      }

      return;
    }

    this.handledSelectionId = id;
    this.headless.selectedAppointmentId.set(id);

    this.editSurfaceRef = this.editSurfaceOpener.open({
      origin: this.takeSurfaceAnchor(),
      bindings: this.editSurfaceBindings(appointment),
    });
  }

  /** Closes the default edit surface without saving, clearing `selectedAppointmentId` back to `null`. */
  public closeEditSurface() {
    this.editSurfaceRef?.close();
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
    if (!this.addSurfaceOpener) {
      if (ngDevMode) {
        throw new RuntimeError(
          SCHEDULER_ERROR_CODES.EDIT_SURFACE_NOT_REGISTERED,
          '[Scheduler] An appointment was added without the default edit surface. Add provideSchedulerEditSurface() to a parent injector.',
        );
      }

      return;
    }

    this.addSurfaceOpener.open({ bindings: this.editSurfaceBindings(appointment) });
  }

  private openDraftSurface(draft: SchedulerDraftRange) {
    if (!this.editSurfaceOpener) {
      if (ngDevMode) {
        throw new RuntimeError(
          SCHEDULER_ERROR_CODES.EDIT_SURFACE_NOT_REGISTERED,
          '[Scheduler] A draft range was committed without the default edit surface. Add provideSchedulerEditSurface() to a parent injector.',
        );
      }

      return;
    }

    const appointment: Appointment = {
      id: randomId(),
      parentId: null,
      title: '',
      start: draft.start,
      end: draft.end,
      allDay: draft.allDay,
    };

    this.openedDraftRange = draft;

    this.draftSurfaceOpener?.open({
      origin: this.takeSurfaceAnchor(),
      bindings: this.editSurfaceBindings(appointment),
    });
  }

  private takeSurfaceAnchor(): HTMLElement | undefined {
    const anchor = this.headless.surfaceAnchor();

    this.headless.surfaceAnchor.set(null);

    return anchor ?? undefined;
  }

  private editSurfaceBindings(appointment: Appointment) {
    return [
      inputBinding('appointment', () => appointment),
      inputBinding('appointments', () => this.headless.appointments()),
    ];
  }

  private handleEditSurfaceResult(result: SchedulerEditSurfaceResult | null | undefined) {
    if (result?.kind === 'save') {
      this.appointmentSave.emit(result.appointment);
    } else if (result?.kind === 'delete') {
      this.appointmentsDelete.emit(result.ids);
    }

    this.handledSelectionId = null;
    this.headless.selectedAppointmentId.set(null);
  }
}
