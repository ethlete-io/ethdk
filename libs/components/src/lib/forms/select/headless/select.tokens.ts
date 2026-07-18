import { ElementRef, Signal, WritableSignal } from '@angular/core';

export type SelectItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
  elementRef: ElementRef<HTMLElement>;
  id: Signal<string>;
  label: Signal<string>;
  /**
   * True for a select's own "Create …" row (`customValueOption`) — excluded from
   * `customValueCandidate`'s duplicate check so the row does not hide itself.
   */
  custom?: Signal<boolean>;
};

export type SelectSelectedEntry = {
  value: unknown;
  /** Resolved display label — `null` when no option, cache entry or string value provides one. */
  label: string | null;
  /** The live option carrying this value, if one is rendered/registered. */
  item: SelectItem | null;
};
