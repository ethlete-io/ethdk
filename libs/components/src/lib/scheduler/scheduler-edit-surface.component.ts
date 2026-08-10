import { NgComponentOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { outputToObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../button';
import { ELLIPSIS_VERTICAL_ICON, IconDirective, PLUS_ICON, provideIcons, TRASH_ICON } from '../icon';
import { MENU_IMPORTS } from '../menu';
import {
  buildAnchoredRuntimePositionStrategy,
  defineOverlay,
  injectAnchoredDialogStrategy,
  injectDialogStrategy,
  injectFullscreenDialogStrategy,
  OVERLAY_REF,
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayRef,
  OverlayTitleDirective,
} from '../overlay';
import { SchedulerActionAddSubAppointmentDirective } from './scheduler-action-add-sub-appointment.directive';
import { SchedulerActionDeleteDirective } from './scheduler-action-delete.directive';
import { SchedulerEditColorDirective } from './scheduler-edit-color.directive';
import { SchedulerEditDescriptionDirective } from './scheduler-edit-description.directive';
import {
  AppointmentTreeNode,
  SCHEDULER_EDIT_SURFACE_HOST,
  SchedulerAppointmentAction,
  SchedulerDirective,
  SchedulerEditField,
  SchedulerEditSurfaceDirective,
  SchedulerEditSurfaceHost,
} from './headless';
import { SchedulerAppointmentStylesComponent } from './scheduler-appointment-styles.component';
import { SchedulerBadgeChainCountComponent } from './scheduler-badge-chain-count.component';
import { SchedulerEditLocationDirective } from './scheduler-edit-location.directive';
import { SchedulerEditTimeRangeDirective } from './scheduler-edit-time-range.directive';
import { SchedulerEditTitleDirective } from './scheduler-edit-title.directive';
import { injectSchedulerLabels } from './scheduler-labels';
import { Appointment, AppointmentId } from './scheduler.types';

/** What `<et-scheduler-edit-surface>`'s overlay closes with. A dismiss without saving closes with `undefined`. */
export type SchedulerEditSurfaceResult =
  { kind: 'save'; appointment: Appointment } | { kind: 'delete'; ids: readonly AppointmentId[] };

/**
 * The default edit surface: a dialog for one appointment, its fields, its ancestor breadcrumb and
 * children list, and an action menu - built on the overlay system. Orchestrates the active fields
 * + actions via `hostDirectives: [SchedulerEditSurfaceDirective]`, bakes the built-in fields and
 * actions in by default (each forwarding its own config input, same pattern as `<et-scheduler>`'s
 * badge adornments), and applies `SCHEDULER_EDIT_SURFACE_HOST` so they can register.
 */
@Component({
  selector: 'et-scheduler-edit-surface',
  templateUrl: './scheduler-edit-surface.component.html',
  styleUrl: './scheduler-edit-surface.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...BUTTON_IMPORTS,
    ...MENU_IMPORTS,
    IconDirective,
    NgComponentOutlet,
    SchedulerBadgeChainCountComponent,
    OverlayBodyComponent,
    OverlayCloseDirective,
    OverlayFooterDirective,
    OverlayHeaderDirective,
    OverlayTitleDirective,
  ],
  providers: [
    provideIcons(PLUS_ICON, TRASH_ICON, ELLIPSIS_VERTICAL_ICON),
    { provide: SCHEDULER_EDIT_SURFACE_HOST, useExisting: SchedulerEditSurfaceComponent },
  ],
  hostDirectives: [
    OverlayMainDirective,
    { directive: SchedulerEditSurfaceDirective, inputs: ['appointment', 'appointments'] },
    // The built-in edit fields and appointment actions, bundled by default so
    // `<et-scheduler-edit-surface>` renders a full surface zero-config - each forwards its own
    // config input, so e.g. `[etSchedulerEditLocation]="{ enabled: false }"` disables just that
    // one piece without dropping to headless composition.
    { directive: SchedulerEditTitleDirective, inputs: ['etSchedulerEditTitle'] },
    { directive: SchedulerEditTimeRangeDirective, inputs: ['etSchedulerEditTimeRange'] },
    { directive: SchedulerEditLocationDirective, inputs: ['etSchedulerEditLocation'] },
    { directive: SchedulerEditDescriptionDirective, inputs: ['etSchedulerEditDescription'] },
    { directive: SchedulerEditColorDirective, inputs: ['etSchedulerEditColor'] },
    { directive: SchedulerActionAddSubAppointmentDirective, inputs: ['etSchedulerActionAddSubAppointment'] },
    { directive: SchedulerActionDeleteDirective, inputs: ['etSchedulerActionDelete'] },
  ],
  host: {
    class: 'et-scheduler-edit-surface',
  },
})
export class SchedulerEditSurfaceComponent implements SchedulerEditSurfaceHost {
  private labels = injectSchedulerLabels();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayRef = inject<OverlayRef<object, SchedulerEditSurfaceResult>>(OVERLAY_REF, { optional: true });
  protected scheduler = inject(SchedulerDirective, { optional: true });

  /** The headless directive behind this surface - field/action registration, draft state and navigation. */
  public surface = inject(SchedulerEditSurfaceDirective);

  public cancelLabel = computed(() => this.labels().cancel);
  public saveLabel = computed(() => this.labels().save);
  public moreActionsLabel = computed(() => this.labels().moreActions);
  public ancestorsLabel = computed(() => this.labels().ancestors);
  public subAppointmentsLabel = computed(() => this.labels().subAppointments);
  public untitledLabel = computed(() => this.labels().untitledAppointment);

  public headerLabel = computed(() => this.surface.currentAppointment().title || this.untitledLabel());

  // UI contributed by edit-field/action features - see SCHEDULER_EDIT_SURFACE_HOST. The built-ins
  // above are features too, registering the same way a consumer's own field/action would.
  private editFieldList = signal<SchedulerEditField[]>([]);
  private appointmentActionList = signal<SchedulerAppointmentAction[]>([]);

  public editFields = computed(() =>
    this.editFieldList()
      .filter((field) => field.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  public appointmentActions = computed(() =>
    this.appointmentActionList()
      .filter((action) => action.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  /** Gates the save button - every currently-enabled field must report itself valid. */
  public canSave = computed(() => this.editFields().every((field) => field.valid?.() ?? true));

  protected childEntries = computed(() => {
    const locale = this.scheduler?.effectiveLocale();
    const options = locale ? { locale } : undefined;

    return this.surface.children().map((node: AppointmentTreeNode) => ({
      node,
      startTime: node.appointment.allDay ? null : format(node.appointment.start, 'HH:mm', options),
    }));
  });

  constructor() {
    // the children list borrows the appointment badge's chain-count chip, and a surface can be
    // opened without any scheduler view having mounted that sheet
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);

    outputToObservable(this.surface.save)
      .pipe(
        takeUntilDestroyed(),
        tap((appointment) => this.overlayRef?.close({ kind: 'save', appointment })),
      )
      .subscribe();

    outputToObservable(this.surface.deleteAppointments)
      .pipe(
        takeUntilDestroyed(),
        tap((ids) => this.overlayRef?.close({ kind: 'delete', ids })),
      )
      .subscribe();
  }

  /** Part of the feature contract - see `SchedulerEditSurfaceHost`. */
  public get element(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  /** Part of the feature contract - see `SchedulerEditSurfaceHost`. */
  public get appointment() {
    return this.surface.currentAppointment;
  }

  /** Part of the feature contract - see `SchedulerEditSurfaceHost`. */
  public get appointmentTree() {
    return this.surface.appointmentTree;
  }

  /** Part of the feature contract - see `SchedulerEditSurfaceHost`. */
  public registerEditField(field: SchedulerEditField) {
    this.editFieldList.update((list) => [...list, field]);
  }

  /** Part of the feature contract - see `SchedulerEditSurfaceHost`. */
  public registerAppointmentAction(action: SchedulerAppointmentAction) {
    this.appointmentActionList.update((list) => [...list, action]);
  }

  protected save() {
    this.surface.commit();
  }
}

/**
 * Opens `<et-scheduler-edit-surface>` anchored to the appointment it edits - what `<et-scheduler>`
 * uses to auto-open on selection. Below `md` it is a full-screen dialog instead, where the form
 * needs the whole viewport. Pass the appointment's element as the open call's `origin`; without one
 * the anchored strategy falls back to a centered dialog.
 */
export const SCHEDULER_EDIT_SURFACE_OVERLAY = /* @__PURE__ */ defineOverlay<
  SchedulerEditSurfaceComponent,
  SchedulerEditSurfaceResult
>({
  component: SchedulerEditSurfaceComponent,
  strategies: () => {
    const fullscreenDialogStrategy = injectFullscreenDialogStrategy();
    const anchoredDialogStrategy = injectAnchoredDialogStrategy();

    return [
      { strategy: fullscreenDialogStrategy.build() },
      {
        breakpoint: 'md',
        strategy: anchoredDialogStrategy.build({
          maxWidth: '520px',
          // centered rather than the anchored dialog's edge-aligned default: the origin is as often
          // a dragged-out range as a single appointment, and a range wants its surface over its middle
          positionStrategy: buildAnchoredRuntimePositionStrategy({
            placement: 'bottom',
            fallbackPlacements: ['top', 'bottom-end', 'top-end'],
            offset: 10,
            arrowPadding: 16,
            shift: true,
            autoResize: true,
          }),
        }),
      },
    ];
  },
  panelClass: 'et-scheduler-edit-surface-panel',
});

/**
 * Opens `<et-scheduler-edit-surface>` as a plain centered dialog above `md`, full-screen below it.
 * Used for an appointment added from the toolbar, which has no appointment on the calendar to
 * anchor to. An add that starts on the calendar itself uses {@link SCHEDULER_EDIT_SURFACE_OVERLAY}.
 */
export const SCHEDULER_ADD_SURFACE_OVERLAY = /* @__PURE__ */ defineOverlay<
  SchedulerEditSurfaceComponent,
  SchedulerEditSurfaceResult
>({
  component: SchedulerEditSurfaceComponent,
  strategies: () => {
    const fullscreenDialogStrategy = injectFullscreenDialogStrategy();
    const dialogStrategy = injectDialogStrategy();

    return [
      { strategy: fullscreenDialogStrategy.build() },
      { breakpoint: 'md', strategy: dialogStrategy.build({ maxWidth: '520px' }) },
    ];
  },
  panelClass: 'et-scheduler-edit-surface-panel',
});
