import { Signal, effect, signal } from '@angular/core';

export type PickerPaneNav = 'forward' | 'backward' | null;

/**
 * The two-pane tab state of a date & time picker: back on the first pane at every opening, and
 * advanced to the second pane by {@link advance} at most once per opening. Call in an injection context.
 */
export const createPickerPanes = <T extends string>(order: readonly [T, T], pickerOpen: Signal<boolean>) => {
  const [first, second] = order;
  const active = signal<T>(first);
  const nav = signal<PickerPaneNav>(null);
  const advanceSpent = signal(false);

  effect(() => {
    if (pickerOpen()) {
      active.set(first);
      nav.set(null);
      advanceSpent.set(false);
    }
  });

  const show = (next: T) => {
    const current = active();

    if (next === current) return;

    nav.set(order.indexOf(next) > order.indexOf(current) ? 'forward' : 'backward');
    active.set(next);
  };

  return {
    active: active.asReadonly(),
    /** Direction of the last switch, `null` while untouched so an opening does not animate. */
    nav: nav.asReadonly(),
    advance: () => {
      if (advanceSpent()) return;

      advanceSpent.set(true);
      show(second);
    },
    select: (pane: unknown) => {
      advanceSpent.set(true);
      show(order.find((candidate) => candidate === pane) ?? first);
    },
  };
};
