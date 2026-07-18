import { DestroyRef, Signal, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';

export type SelectionStateItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
};

export type SelectionStateConfig<TValue = unknown> = {
  value: WritableSignal<TValue | TValue[] | null>;
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
  /**
   * When `true`, unregistering a *checked* item recomputes `value` from the remaining checked
   * items, so destroying a selected option (e.g. `@for` churn) doesn't strand its value in the
   * model. Off by default — the select family keeps values whose option isn't currently rendered
   * (async/filtered lists), so it must not prune. Selection-list groups render every option, so
   * a removed option is genuinely gone and opts in.
   */
  pruneValueOnUnregister?: boolean;
};

export type SelectionState<TValue = unknown, TItem extends SelectionStateItem<TValue> = SelectionStateItem<TValue>> = {
  items: Signal<TItem[]>;
  allSelected: Signal<boolean>;
  someSelected: Signal<boolean>;
  registerItem: (item: TItem) => void;
  unregisterItem: (item: TItem) => void;
  select: (item: TItem) => void;
  toggleAll: () => void;
};

/**
 * Item registry + value↔items sync shared by every selection-shaped control
 * (selection list groups, the select family). Must be created in an injection
 * context — it installs the effect that pushes value changes into the items.
 */
export const createSelectionState = <
  TValue = unknown,
  TItem extends SelectionStateItem<TValue> = SelectionStateItem<TValue>,
>(
  config: SelectionStateConfig<TValue>,
): SelectionState<TValue, TItem> => {
  const items = signal<TItem[]>([]);

  // when the whole owner (list, form) tears down, every item unregisters in a cascade — pruning
  // then would clobber the form value to empty. This flag flips synchronously during teardown, and
  // the prune below runs in a microtask, so a genuine teardown is always seen as destroyed by then
  // (order-independent of whether parent or child destroy hooks fire first).
  let destroyed = false;

  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
  });

  // `toggleAll` can only ever mutate enabled items, so the select-all tri-state must be
  // computed over that same set. Evaluating `every`/`length` over all items (incl. disabled)
  // meant a single disabled-and-unchecked item pinned `allSelected` to false forever, leaving
  // the select-all control stuck showing "mixed" that no click could clear.
  const togglableItems = computed(() => items().filter((item) => !item.disabled()));

  const allSelected = computed(() => {
    const list = togglableItems();

    if (list.length === 0) {
      return false;
    }

    return list.every((item) => item.checked());
  });

  const someSelected = computed(() => {
    const list = togglableItems();

    if (list.length === 0) {
      return false;
    }

    const checkedCount = list.filter((item) => item.checked()).length;

    return checkedCount > 0 && checkedCount < list.length;
  });

  effect(() => {
    const currentValue = config.value();
    const currentItems = items();

    if (currentItems.length === 0) {
      return;
    }

    // item values read tracked: an item's value signal may resolve late (projected options
    // bind their inputs only once rendered) — the sync must re-run when it does, or items
    // registered before their bindings executed stay unchecked forever
    const syncEntries = currentItems.map((item) => ({ item, itemValue: item.value() }));

    untracked(() => {
      if (config.multiple()) {
        const valueArray = Array.isArray(currentValue) ? currentValue : [];

        for (const { item, itemValue } of syncEntries) {
          item.checked.set(valueArray.includes(itemValue));
        }
      } else {
        for (const { item, itemValue } of syncEntries) {
          item.checked.set(itemValue === currentValue);
        }
      }
    });
  });

  const registerItem = (item: TItem) => {
    items.update((list) => [...list, item]);
  };

  const unregisterItem = (item: TItem) => {
    const wasChecked = item.checked();

    items.update((list) => list.filter((i) => i !== item));

    if (!config.pruneValueOnUnregister || !wasChecked) {
      return;
    }

    // defer to a microtask so a full teardown (which unregisters every item) is skipped via the
    // `destroyed` guard, while a single-option removal (@for churn, owner still alive) reconciles
    queueMicrotask(() => {
      if (destroyed) {
        return;
      }

      const remainingChecked = items().filter((i) => i.checked());

      if (config.multiple()) {
        config.value.set(remainingChecked.map((i) => i.value()));
      } else {
        config.value.set(remainingChecked[0]?.value() ?? null);
      }
    });
  };

  const select = (item: TItem) => {
    if (config.disabled() || item.disabled()) {
      return;
    }

    if (config.multiple()) {
      item.checked.update((v) => !v);
      config.value.set(
        items()
          .filter((i) => i.checked())
          .map((i) => i.value()),
      );
    } else {
      for (const i of items()) {
        i.checked.set(i === item);
      }

      config.value.set(item.value());
    }
  };

  const toggleAll = () => {
    if (config.disabled()) {
      return;
    }

    const shouldCheck = !allSelected();

    for (const item of items()) {
      if (!item.disabled()) {
        item.checked.set(shouldCheck);
      }
    }

    config.value.set(
      items()
        .filter((i) => i.checked())
        .map((i) => i.value()),
    );
  };

  return {
    items: items.asReadonly(),
    allSelected,
    someSelected,
    registerItem,
    unregisterItem,
    select,
    toggleAll,
  };
};
