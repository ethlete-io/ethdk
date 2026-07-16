import { Signal, WritableSignal, computed, effect, signal, untracked } from '@angular/core';

export type SelectionStateItem<TValue = unknown> = {
  value: Signal<TValue>;
  checked: WritableSignal<boolean>;
  disabled: Signal<boolean>;
};

export type SelectionStateConfig<TValue = unknown> = {
  value: WritableSignal<TValue | TValue[] | null>;
  multiple: Signal<boolean>;
  disabled: Signal<boolean>;
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

  const allSelected = computed(() => {
    const list = items();

    if (list.length === 0) {
      return false;
    }

    return list.every((item) => item.checked());
  });

  const someSelected = computed(() => {
    const list = items();

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
    items.update((list) => list.filter((i) => i !== item));
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
