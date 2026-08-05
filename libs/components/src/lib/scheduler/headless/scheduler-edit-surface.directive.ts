import { computed, Directive, input, linkedSignal, output, signal } from '@angular/core';
import { randomId } from '@ethlete/core';
import { Appointment, AppointmentId } from '../scheduler.types';
import { buildAppointmentTree, collectDescendantIds, findAppointmentNode } from './internals/scheduler-tree';

/**
 * Headless edit-surface state: which appointment is open, the live draft every field reads and
 * writes, and navigation across the sub-appointment chain (ancestors, children, "add
 * sub-appointment") - all without any template structure. `<et-scheduler-edit-surface>` applies
 * this via `hostDirectives` and renders the registered fields/actions on top (see
 * `SCHEDULER_EDIT_SURFACE_HOST`).
 */
@Directive({
  selector: '[etSchedulerEditSurface]',
  exportAs: 'etSchedulerEditSurface',
})
export class SchedulerEditSurfaceDirective<TExtra = unknown> {
  /** The appointment to open the surface for - a freshly-synthesized blank one (with `id` already assigned) for "add". */
  public appointment = input.required<Appointment<TExtra>>();

  /** Every appointment the scheduler knows about - for the ancestor breadcrumb, the children list, and chain-aware actions. */
  public appointments = input<readonly Appointment<TExtra>[]>([]);

  /** Emits the draft when the surface commits an edit or a new sub-appointment. */
  public save = output<Appointment<TExtra>>();

  /** Emits every id to remove - the current appointment plus, for "delete with descendants", its whole chain. */
  public deleteAppointments = output<readonly AppointmentId[]>();

  public appointmentTree = computed(() => buildAppointmentTree(this.appointments()));

  /** A synthesized appointment not yet in `appointments()` - set while "add sub-appointment" is in progress. */
  private pendingAppointment = signal<Appointment<TExtra> | null>(null);

  /**
   * Which appointment id the surface is currently showing. Starts at `appointment()`'s id;
   * breadcrumb/children navigation and "add sub-appointment" move it without opening a new dialog.
   */
  public currentAppointmentId = linkedSignal(() => this.appointment().id);

  /** The pre-edit snapshot of whichever appointment is currently shown. */
  public currentAppointment = computed(
    () =>
      this.pendingAppointment() ??
      this.appointments().find((candidate) => candidate.id === this.currentAppointmentId()) ??
      this.appointment(),
  );

  /**
   * The live draft every edit field reads and writes. Resets to `currentAppointment()` whenever
   * the surface navigates - unsaved edits are discarded on navigation, the same "edit a copy"
   * tradeoff the filter overlay makes.
   */
  public draft = linkedSignal(() => this.currentAppointment());

  /** `currentAppointment()`'s ancestor chain, root first - what the breadcrumb renders. */
  public ancestors = computed(() => {
    const byId = new Map(this.appointments().map((candidate) => [candidate.id, candidate]));
    const chain: Appointment<TExtra>[] = [];
    const seen = new Set<AppointmentId>();

    let parentId = this.currentAppointment().parentId;

    while (parentId !== null && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);

      if (!parent) {
        break;
      }

      chain.unshift(parent);
      parentId = parent.parentId;
    }

    return chain;
  });

  private currentNode = computed(() => findAppointmentNode(this.appointmentTree(), this.currentAppointmentId()));

  /** `currentAppointment()`'s direct children - what the children list renders, each navigable via `navigateTo`. */
  public children = computed(() => this.currentNode()?.children ?? []);

  /**
   * Navigates to a different appointment already in `appointments()` - a breadcrumb ancestor or a
   * child in the list. Discards any unsaved draft edits for the appointment navigated away from.
   */
  public navigateTo(id: AppointmentId) {
    this.pendingAppointment.set(null);
    this.currentAppointmentId.set(id);
  }

  /** Starts "add sub-appointment": synthesizes a blank child of `currentAppointment()` and navigates to it. */
  public startAddSubAppointment() {
    const parent = this.currentAppointment();

    const blank: Appointment<TExtra> = {
      id: randomId(),
      parentId: parent.id,
      title: '',
      start: parent.start,
      end: parent.end,
    };

    this.pendingAppointment.set(blank);
    this.currentAppointmentId.set(blank.id);
  }

  /** Commits the current draft via `save` - the component closes the dialog on this. */
  public commit() {
    this.save.emit(this.draft());
  }

  /** Emits `deleteAppointments` for the current appointment and every descendant - the component closes the dialog on this. */
  public requestDelete() {
    const node = this.currentNode();
    const ids = node ? [node.appointment.id, ...collectDescendantIds(node)] : [this.currentAppointment().id];

    this.deleteAppointments.emit(ids);
  }
}
