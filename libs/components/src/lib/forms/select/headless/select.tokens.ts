import { Signal, WritableSignal } from '@angular/core';

/**
 * One entry of the select's `options` input (data-driven mode). Values must be unique —
 * a duplicate value cannot be represented as a distinct choice and is skipped. Extra
 * fields are kept and handed to `etSelectOptionTemplate` via the template context.
 */
export type SelectOptionData<TValue = unknown> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

export type SelectItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
  /**
   * The rendered option element. Always set for a projected option; `null` for a
   * data-driven (`options` input) item whose row is currently outside the rendered window.
   */
  element: Signal<HTMLElement | null>;
  id: Signal<string>;
  label: Signal<string>;
  /**
   * True for a select's own "Create …" row (`customValueOption`) — excluded from
   * `customValueCandidate`'s duplicate check so the row does not hide itself.
   */
  custom?: Signal<boolean>;
  /** Set for data-driven items — the source entry from the `options` input, extra fields included. */
  data?: Signal<SelectOptionData>;
};

export type SelectSelectedEntry = {
  value: unknown;
  /** Resolved display label — `null` when no option, cache entry or string value provides one. */
  label: string | null;
  /** The live option carrying this value, if one is rendered/registered. */
  item: SelectItem | null;
};
