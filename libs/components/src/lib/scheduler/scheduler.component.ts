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
import { randomId } from '@ethlete/core';
import { addHours, format, isSameDay, isSameMonth, isSameYear, setHours, setMinutes, startOfDay } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { LabelDirective, SEGMENTED_BUTTON_IMPORTS } from '../forms';
import { CHEVRON_ICON, IconDirective, PLUS_ICON, provideIcons } from '../icon';
import { createOverlayOpener } from '../overlay';
import {
  SCHEDULER_FEATURE_HOST,
  SchedulerBadgeAdornment,
  SchedulerDirective,
  SchedulerFeatureHost,
  SchedulerToolbarAction,
} from './headless';
import { SchedulerActionAddAppointmentDirective } from './scheduler-action-add-appointment.directive';
import { SchedulerAgendaViewComponent } from './scheduler-agenda-view.component';
import { SchedulerBadgeChainCountDirective } from './scheduler-badge-chain-count.directive';
import { SchedulerBadgeColorDotDirective } from './scheduler-badge-color-dot.directive';
import { SchedulerBadgeLocationDirective } from './scheduler-badge-location.directive';
import { SchedulerBadgeTimeRangeDirective } from './scheduler-badge-time-range.directive';
import { SchedulerBadgeTitleDirective } from './scheduler-badge-title.directive';
import { SCHEDULER_EDIT_SURFACE_OVERLAY } from './scheduler-edit-surface.component';
import { injectSchedulerLabels } from './scheduler-labels';
import { SchedulerMonthViewComponent } from './scheduler-month-view.component';
import { SchedulerTimeGridViewComponent } from './scheduler-time-grid-view.component';
import { Appointment, AppointmentId, SchedulerView } from './scheduler.types';

@Component({
  selector: 'et-scheduler',
  templateUrl: './scheduler.component.html',
  styleUrl: './scheduler.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    ...SEGMENTED_BUTTON_IMPORTS,
    LabelDirective,
    IconDirective,
    SchedulerAgendaViewComponent,
    SchedulerMonthViewComponent,
    SchedulerTimeGridViewComponent,
  ],
  providers: [
    provideIcons(CHEVRON_ICON, PLUS_ICON),
    { provide: SCHEDULER_FEATURE_HOST, useExisting: SchedulerComponent },
  ],
  hostDirectives: [
    {
      directive: SchedulerDirective,
      inputs: ['appointments', 'view', 'focusedDate', 'selectedAppointmentId', 'locale', 'firstDayOfWeek'],
      outputs: ['viewChange', 'focusedDateChange', 'selectedAppointmentIdChange'],
    },
    // The built-in badge adornments, bundled by default so `<et-scheduler>` renders a full badge
    // zero-config - each forwards its own config input, so e.g. `[etSchedulerBadgeLocation]="{
    // enabled: false }"` disables just that one piece without dropping to headless composition.
    { directive: SchedulerBadgeColorDotDirective, inputs: ['etSchedulerBadgeColorDot'] },
    { directive: SchedulerBadgeTitleDirective, inputs: ['etSchedulerBadgeTitle'] },
    { directive: SchedulerBadgeTimeRangeDirective, inputs: ['etSchedulerBadgeTimeRange'] },
    { directive: SchedulerBadgeLocationDirective, inputs: ['etSchedulerBadgeLocation'] },
    { directive: SchedulerBadgeChainCountDirective, inputs: ['etSchedulerBadgeChainCount'] },
    { directive: SchedulerActionAddAppointmentDirective, inputs: ['etSchedulerActionAddAppointment'] },
  ],
  host: {
    class: 'et-scheduler',
  },
})
export class SchedulerComponent implements SchedulerFeatureHost {
  private labels = injectSchedulerLabels();

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

  // UI contributed by badge features (title, time range, location, …), rendered in every
  // appointment badge/block by every view. Features register themselves (see
  // SCHEDULER_FEATURE_HOST) rather than being queried - the built-ins above are features too.
  private badgeAdornmentList = signal<SchedulerBadgeAdornment[]>([]);

  public badgeAdornments = computed(() =>
    this.badgeAdornmentList()
      .filter((adornment) => adornment.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  // UI contributed by toolbar features (just "Add appointment" today) - rendered in the header
  // alongside the built-in nav controls. Same registration story as the badge adornments above.
  private toolbarActionList = signal<SchedulerToolbarAction[]>([]);

  public toolbarActions = computed(() =>
    this.toolbarActionList()
      .filter((action) => action.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  /**
   * Opens `<et-scheduler-edit-surface>` for the selected appointment - covers the zero-config
   * case (no feature directives applied) per the plan. Its result bubbles as `appointmentSave` /
   * `appointmentsDelete`, and closing always clears `selectedAppointmentId` back to `null` so
   * clicking the same appointment again reopens a fresh surface.
   */
  private editSurfaceOpener = createOverlayOpener(SCHEDULER_EDIT_SURFACE_OVERLAY, {
    afterClosed: (result) => {
      if (result?.kind === 'save') {
        this.appointmentSave.emit(result.appointment);
      } else if (result?.kind === 'delete') {
        this.appointmentsDelete.emit(result.ids);
      }

      this.headless.selectedAppointmentId.set(null);
    },
  });

  constructor() {
    effect(() => {
      const appointment = this.headless.selectedAppointment();

      if (!appointment) {
        return;
      }

      untracked(() => this.openEditSurface(appointment));
    });
  }

  /** Bound to the view-switch's `(valueChange)` - safe to cast since every `<et-segmented-button>` below carries a `SchedulerView` literal. */
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

    this.openEditSurface({ id: randomId(), parentId: null, title: '', start, end: addHours(start, 1) });
  }

  /** The scheduler's own element. Part of the feature contract (a feature is a directive on it). */
  public get element(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public get appointmentTree() {
    return this.headless.appointmentTree;
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public get selectedAppointment() {
    return this.headless.selectedAppointment;
  }

  public appointments(): readonly Appointment[] {
    return this.headless.visibleAppointments();
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public registerBadgeAdornment(adornment: SchedulerBadgeAdornment) {
    this.badgeAdornmentList.update((list) => [...list, adornment]);
  }

  /** Part of the feature contract - see `SchedulerFeatureHost`. */
  public registerToolbarAction(action: SchedulerToolbarAction) {
    this.toolbarActionList.update((list) => [...list, action]);
  }

  private openEditSurface(appointment: Appointment) {
    this.editSurfaceOpener.open({
      bindings: [
        inputBinding('appointment', () => appointment),
        inputBinding('appointments', () => this.headless.appointments()),
      ],
    });
  }
}
