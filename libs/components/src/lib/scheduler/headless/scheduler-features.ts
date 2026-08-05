import { inject, InjectionToken, Injector, InputSignal, Signal, Type } from '@angular/core';
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
