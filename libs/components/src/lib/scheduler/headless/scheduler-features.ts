import { computed, inject, InjectionToken, Injector, InputSignal, Signal, signal, Type } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { SCHEDULER_ERROR_CODES } from '../scheduler-errors';
import { Appointment, AppointmentId } from '../scheduler.types';
import { AppointmentTreeNode } from './internals/scheduler-tree';

/** What every registration point on a scheduler host shares: an optional render order and on/off switch. */
export type SchedulerRegistryEntry = {
  order?: number;
  enabled?: Signal<boolean>;
};

export type SchedulerRegistry<T extends SchedulerRegistryEntry> = {
  /** The registered entries, enabled ones only, sorted by `order` (registration order breaks ties). */
  entries: Signal<readonly T[]>;
  /** Adds an entry. Unbound-safe, so it can be assigned straight onto a host as its `register…` method. */
  register: (entry: T) => void;
};

/**
 * The registration list behind every `register…`/list pair on {@link SchedulerFeatureHost}. Use one
 * per pair when implementing the host on your own component:
 * `badgeAdornments = registry.entries; registerBadgeAdornment = registry.register;`.
 */
export const createSchedulerRegistry = <T extends SchedulerRegistryEntry>(): SchedulerRegistry<T> => {
  const list = signal<readonly T[]>([]);

  return {
    entries: computed(() =>
      list()
        .filter((entry) => entry.enabled?.() ?? true)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    ),
    register: (entry) => list.update((current) => [...current, entry]),
  };
};

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
 * `TableFeatureHost`: the read-only surface every feature needs, plus the badge adornment and
 * toolbar action registration points.
 */
export type SchedulerFeatureHost<TExtra = unknown> = {
  /** The appointments currently in view - already filtered to the visible range. */
  visibleAppointments(): readonly Appointment<TExtra>[];
  /** Every appointment the scheduler knows about, arranged into sub-appointment chains - see `buildAppointmentTree`. */
  appointmentTree(): AppointmentTreeNode<TExtra>[];
  /** The currently selected appointment, or `null`. */
  selectedAppointment(): Appointment<TExtra> | null;
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
   * Synthesizes a brand-new, blank top-level appointment and opens the registered edit surface
   * for it. Exposed on the host so a built-in toolbar action can call it without importing the
   * component that bundles it.
   */
  addAppointment(): void;
  /** Whether {@link addAppointment} can open anything. The built-in add action hides itself when this returns `false`. */
  canAddAppointment?(): boolean;
  /**
   * Opens the edit surface for an appointment that is already selected, where writing the same id
   * again changes nothing. The views call it when an already-selected appointment is activated.
   */
  openEditSurface?(id: AppointmentId): void;
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
export const injectSchedulerFeatureHost = <TExtra = unknown>(feature: string): SchedulerFeatureHost<TExtra> => {
  const host = inject(SCHEDULER_FEATURE_HOST, { optional: true });

  if (!host) {
    throw new RuntimeError(
      SCHEDULER_ERROR_CODES.FEATURE_OUTSIDE_SCHEDULER,
      `[${feature}] must be used inside an <et-scheduler>.`,
    );
  }

  return host as SchedulerFeatureHost<TExtra>;
};
