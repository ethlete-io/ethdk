import { Signal } from '@angular/core';

/**
 * One field of a query form, as the devtools panel reads it: what it holds, what it puts in the URL,
 * and the rules that decide when either changes.
 */
export type QueryDevtoolsFormField = {
  key: string;

  /** The query-param key the field serializes to, with the form's prefix applied. */
  paramKey: string;

  /** The committed value - what the query args are built from. */
  value: unknown;

  /** The live value of the bound control, which differs from {@link value} while a debounce is pending. */
  liveValue: unknown;

  defaultValue: unknown;

  /** Whether the committed value is the default one. */
  isDefault: boolean;

  /** What the field writes to the URL, or `undefined` when it writes nothing. */
  queryParam: unknown;

  /** How long a change waits before it is committed, or `null` when it commits immediately. */
  debounceMs: number | null;

  /** The sibling fields whose change resets this one back to its default. */
  isResetBy: readonly string[];

  /** Whether the field counts towards {@link QueryDevtoolsFormHandle.activeFilterCount}. */
  countsAsFilter: boolean;
};

/**
 * The live state of a query form, as `<et-query-devtools>` renders it. Part of the devtools contract -
 * not a general-purpose query-form API.
 */
export type QueryDevtoolsFormHandle = {
  fields: Signal<QueryDevtoolsFormField[]>;

  /** The committed value of the whole form. */
  value: Signal<Record<string, unknown>>;

  /** The value of every field before the most recent commit, or `null` before the first one. */
  previousValue: Signal<Record<string, unknown> | null>;

  defaultValue: Record<string, unknown>;

  /** @see QueryFormSignals.activeFilterCount */
  activeFilterCount: Signal<number>;

  /** Whether every field sits at its default. */
  isAtDefaults: Signal<boolean>;

  /** Whether a change is waiting out its debounce, so the committed value is one edit behind. */
  isCommitPending: Signal<boolean>;

  /** Whether the form is syncing with the URL, i.e. whether `observe()` has been called. */
  isObserving: Signal<boolean>;

  resetField: (key: string) => void;

  resetAll: () => void;
};
