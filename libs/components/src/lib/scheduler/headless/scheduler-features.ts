import { inject, InjectionToken, Injector, InputSignal, Signal, Type, WritableSignal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { Appointment } from '../scheduler.types';
import { AppointmentTreeNode } from './internals/scheduler-tree';

/**
 * A feature's contribution to every appointment badge/block - e.g. the title, a time range, the
 * location icon. The scheduler stamps `component` into every rendered badge (month cell, time-grid
 * block, agenda row), so the feature itself never needs a view of its own beyond this one piece.
 */
export type SchedulerBadgeAdornment = {
  /** The component to stamp. It must declare a `node` input to receive the tree node it renders for. */
  component: Type<{ node: InputSignal<AppointmentTreeNode> }>;
  /**
   * The injector the stamped component resolves from - pass the feature's own (`inject(Injector)`)
   * so the component can inject the feature that registered it. Defaults to the scheduler's own.
   */
  injector?: Injector;
  /**
   * Render order within the badge - lower renders first. The built-ins take `-10` (color dot),
   * `0` (title), `10` (time range), `20` (location), `30` (chain count); pick a number relative to
   * those to place your own adornment among them.
   *
   * @default 0
   */
  order?: number;
  /**
   * Whether this contribution is live. A feature registers once, in its constructor, and gates
   * itself with this rather than re-registering - so `[etSchedulerBadgeLocation]="{ enabled: … }"`
   * can be toggled at runtime. Omitted means always on.
   */
  enabled?: Signal<boolean>;
};

/** One entry in the scheduler's own toolbar - e.g. "Add appointment". */
export type SchedulerToolbarAction = {
  /** A signal so the built-ins stay correct if the app's labels/locale change at runtime. */
  label: Signal<string>;
  /** A registered icon name (see `IconDirective`), shown before the label. */
  icon?: string;
  /** Runs the action - called with the scheduler's own feature host still in scope. */
  run: () => void;
  /**
   * Render order - lower renders first. The built-in "Add appointment" takes `0`; pick a number
   * relative to that to place your own action among the built-ins.
   *
   * @default 0
   */
  order?: number;
  /** Whether this action is live. Omitted means always on - see {@link SchedulerBadgeAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * What an opt-in scheduler feature can reach on its host `<et-scheduler>`. Features **register**
 * themselves here (the scheduler never queries for them) - modeled on the table's
 * `TableFeatureHost`. This is the read-only surface every feature needs regardless of which one
 * it is; registration points (badge adornments, edit-surface fields, appointment actions, grid
 * overlays) are added here incrementally as the features that need them land.
 */
export type SchedulerFeatureHost = {
  /** The appointments currently in view - already filtered to the visible range. */
  appointments(): readonly Appointment[];
  /** {@link appointments}, arranged into sub-appointment chains - see `buildAppointmentTree`. */
  appointmentTree(): AppointmentTreeNode[];
  /** The currently selected appointment, or `null`. */
  selectedAppointment(): Appointment | null;
  /** The scheduler's host element - a feature is a directive on it, so this is also what it can listen on or measure. */
  readonly element: HTMLElement;
  /** Add a piece of content to every appointment badge/block. Call once, from the feature's constructor. */
  registerBadgeAdornment(adornment: SchedulerBadgeAdornment): void;
  /** The registered badge adornments, enabled ones only, in render order - what every view renders per badge. */
  badgeAdornments(): readonly SchedulerBadgeAdornment[];
  /** Add an entry to the scheduler's own toolbar. Call once, from the feature's constructor. */
  registerToolbarAction(action: SchedulerToolbarAction): void;
  /** The registered toolbar actions, enabled ones only, in render order. */
  toolbarActions(): readonly SchedulerToolbarAction[];
  /**
   * Synthesizes a brand-new, blank top-level appointment and opens the default edit surface for
   * it - only meaningful with that default surface, the same caveat the scheduler's own
   * click-to-edit behavior already has. Exposed on the host (rather than a feature injecting
   * `SchedulerComponent` directly) so a built-in toolbar action can call it without a static
   * import cycle back to the component that bundles it.
   */
  addAppointment(): void;
};

export const SCHEDULER_FEATURE_HOST = new InjectionToken<SchedulerFeatureHost>('SCHEDULER_FEATURE_HOST');

/** Options every badge adornment feature accepts on top of its own. */
export type SchedulerFeatureConfig = {
  /**
   * Turn the feature off without removing it - a directive can't be applied conditionally, so this
   * is how `[etSchedulerBadgeLocation]="{ enabled: canShow() }"` toggles at runtime. @default true
   */
  enabled?: boolean;
};

/**
 * Read a feature's config input. A feature directive is usually written bare
 * (`etSchedulerBadgeLocation`), which Angular binds as the empty string - normalize that to "no
 * options given".
 */
export const schedulerFeatureConfig = <TConfig extends SchedulerFeatureConfig>(value: TConfig | '') =>
  value === '' ? ({} as TConfig) : value;

/**
 * Inject the host scheduler from inside a feature. Throws a labelled error when the feature was
 * placed outside an `<et-scheduler>`, where it could only ever silently do nothing.
 */
export const injectSchedulerFeatureHost = (feature: string): SchedulerFeatureHost => {
  const host = inject(SCHEDULER_FEATURE_HOST, { optional: true });

  if (!host) {
    throw new RuntimeError(
      SCHEDULER_ERROR_CODES.FEATURE_OUTSIDE_SCHEDULER,
      `[${feature}] must be used inside an <et-scheduler>.`,
    );
  }

  return host;
};

/**
 * One field the edit surface renders for the appointment it's editing - e.g. the title, the time
 * range, the location. Deliberately not part of {@link SchedulerFeatureHost}: a badge adornment
 * describes one appointment among many visible ones, while an edit field describes the single
 * appointment `<et-scheduler-edit-surface>` has open, so the two hosts expose different data.
 */
export type SchedulerEditField = {
  /**
   * The component to stamp. Must declare `draft` as a required input typed
   * `WritableSignal<Appointment>` - the appointment being edited, shared by every field. Call
   * `draft()` for the writable signal, then read it (`draft()()`) or write it
   * (`draft().update(a => ({ ...a, title: value }))`).
   */
  component: Type<{ draft: InputSignal<WritableSignal<Appointment>> }>;
  /**
   * The injector the stamped component resolves from - pass the feature's own (`inject(Injector)`)
   * so the component can inject the feature that registered it. Defaults to the surface's own.
   */
  injector?: Injector;
  /**
   * Render order within the surface - lower renders first. The built-ins take `0` (title), `10`
   * (time range), `20` (location), `30` (description), `40` (color); pick a number relative to
   * those to place your own field among them.
   *
   * @default 0
   */
  order?: number;
  /** Whether this field is live. Omitted means always on - see {@link SchedulerBadgeAdornment.enabled}. */
  enabled?: Signal<boolean>;
  /** Whether the field's current draft value is valid - gates the surface's save button. Omitted means always valid. */
  valid?: Signal<boolean>;
};

/** One entry in the edit surface's action menu - e.g. "Add sub-appointment", "Delete (with descendants)". */
export type SchedulerAppointmentAction = {
  /** A signal so the built-ins stay correct if the app's labels/locale change at runtime. */
  label: Signal<string>;
  /** A registered icon name (see `IconDirective`), shown before the label. */
  icon?: string;
  /** Runs the action - called with the surface's feature host still in scope, so it can read `appointment()`/`appointmentTree()`. */
  run: () => void;
  /**
   * Render order - lower renders first. The built-ins take `0` ("Add sub-appointment") and `100`
   * ("Delete (with descendants)").
   *
   * @default 0
   */
  order?: number;
  enabled?: Signal<boolean>;
  /** Renders the action with the app's error color (`et-menu-item`'s `destructive` variant). @default false */
  destructive?: boolean;
};

/**
 * What an opt-in edit-surface feature can reach on its host `<et-scheduler-edit-surface>` -
 * modeled on {@link SchedulerFeatureHost}, but scoped to the single appointment the surface has
 * open rather than every visible one.
 */
export type SchedulerEditSurfaceHost = {
  /** The pre-edit snapshot of the appointment currently open - stable identity for actions (e.g. "add sub-appointment" reading its id as `parentId`). Live edits are read from the field's own `draft`. */
  appointment(): Appointment;
  /** Every appointment the scheduler knows about, arranged into chains - for the ancestor breadcrumb, the children list, and descendant-collecting actions. */
  appointmentTree(): AppointmentTreeNode[];
  /** The surface's own host element. */
  readonly element: HTMLElement;
  /** Add a field to the surface. Call once, from the feature's constructor. */
  registerEditField(field: SchedulerEditField): void;
  /** The registered edit fields, enabled ones only, in render order. */
  editFields(): readonly SchedulerEditField[];
  /** Add an entry to the surface's action menu. Call once, from the feature's constructor. */
  registerAppointmentAction(action: SchedulerAppointmentAction): void;
  /** The registered appointment actions, enabled ones only, in render order. */
  appointmentActions(): readonly SchedulerAppointmentAction[];
};

export const SCHEDULER_EDIT_SURFACE_HOST = new InjectionToken<SchedulerEditSurfaceHost>('SCHEDULER_EDIT_SURFACE_HOST');

/**
 * Inject the host edit surface from inside a feature. Throws a labelled error when the feature was
 * placed outside an `<et-scheduler-edit-surface>`, where it could only ever silently do nothing.
 */
export const injectSchedulerEditSurfaceHost = (feature: string): SchedulerEditSurfaceHost => {
  const host = inject(SCHEDULER_EDIT_SURFACE_HOST, { optional: true });

  if (!host) {
    throw new RuntimeError(
      SCHEDULER_ERROR_CODES.EDIT_SURFACE_FEATURE_OUTSIDE_SURFACE,
      `[${feature}] must be used inside an <et-scheduler-edit-surface>.`,
    );
  }

  return host;
};
