import { NgComponentOutlet } from '@angular/common';
import { Component, computed, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { format } from 'date-fns';
import { BUTTON_IMPORTS } from '../button';
import { ELLIPSIS_VERTICAL_ICON, IconDirective, PLUS_ICON, provideIcons, TRASH_ICON } from '../icon';
import { MENU_IMPORTS } from '../menu';
import {
  OverlayBodyComponent,
  OverlayCloseDirective,
  OverlayFooterDirective,
  OverlayHeaderDirective,
  OverlayMainDirective,
  OverlayTitleDirective,
} from '../overlay';
import { SchedulerActionAddSubAppointmentDirective } from './scheduler-action-add-sub-appointment.directive';
import { SchedulerActionDeleteDirective } from './scheduler-action-delete.directive';
import { SchedulerEditColorDirective } from './scheduler-edit-color.directive';
import { SchedulerEditDescriptionDirective } from './scheduler-edit-description.directive';
import {
  AppointmentTreeNode,
  createSchedulerRegistry,
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
import { defineSchedulerAddOverlay, defineSchedulerEditOverlay } from './scheduler-edit-surface-overlays';

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
  private scheduler = inject(SchedulerDirective, { optional: true });

  /** The headless directive behind this surface - field/action registration, draft state and navigation. */
  public surface = inject(SchedulerEditSurfaceDirective);

  public cancelLabel = computed(() => this.labels().cancel);
  public saveLabel = computed(() => this.labels().save);
  public moreActionsLabel = computed(() => this.labels().moreActions);
  public ancestorsLabel = computed(() => this.labels().ancestors);
  public subAppointmentsLabel = computed(() => this.labels().subAppointments);
  public untitledLabel = computed(() => this.labels().untitledAppointment);

  public headerLabel = computed(() => this.surface.currentAppointment().title || this.untitledLabel());

  private editFieldRegistry = createSchedulerRegistry<SchedulerEditField>();
  private appointmentActionRegistry = createSchedulerRegistry<SchedulerAppointmentAction>();

  public canSave = computed(() => this.editFields().every((field) => field.valid?.() ?? true));

  protected childEntries = computed(() => {
    const locale = this.scheduler?.effectiveLocale();
    const options = locale ? { locale } : undefined;

    return this.surface.children().map((node: AppointmentTreeNode) => ({
      node,
      startTime: node.appointment.allDay ? null : format(node.appointment.start, 'p', options),
    }));
  });

  constructor() {
    // the children list borrows the appointment badge's chain-count chip, and a surface can be
    // opened without any scheduler view having mounted that sheet
    injectStyleManager().mount(SchedulerAppointmentStylesComponent);
  }

  public editFields() {
    return this.editFieldRegistry.entries();
  }

  public appointmentActions() {
    return this.appointmentActionRegistry.entries();
  }

  public get element(): HTMLElement {
    return this.elementRef.nativeElement;
  }

  public get appointment() {
    return this.surface.currentAppointment;
  }

  public get appointmentTree() {
    return this.surface.appointmentTree;
  }

  public registerEditField(field: SchedulerEditField) {
    this.editFieldRegistry.register(field);
  }

  public registerAppointmentAction(action: SchedulerAppointmentAction) {
    this.appointmentActionRegistry.register(action);
  }

  protected save() {
    this.surface.commit();
  }
}

/**
 * Opens `<et-scheduler-edit-surface>` anchored to the appointment it edits. Below `md` it is a
 * full-screen dialog instead, where the form needs the whole viewport. Pass the appointment's element
 * as the open call's `origin`; without one the anchored strategy falls back to a centered dialog.
 */
export const SCHEDULER_EDIT_SURFACE_OVERLAY = /* @__PURE__ */ defineSchedulerEditOverlay(SchedulerEditSurfaceComponent);

/**
 * Opens `<et-scheduler-edit-surface>` as a plain centered dialog above `md`, full-screen below it -
 * for an appointment with nothing on the calendar to anchor to.
 */
export const SCHEDULER_ADD_SURFACE_OVERLAY = /* @__PURE__ */ defineSchedulerAddOverlay(SchedulerEditSurfaceComponent);
