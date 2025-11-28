import { computed, signal } from '@angular/core';
import { createRootProvider } from '@ethlete/core';

export type FocusElementRegistryEntry = {
  id: string;
  afterOpenFocus: HTMLElement;
  afterCloseFocus: HTMLElement;
};

export const [provideFocusRegistry, injectFocusRegistry] = createRootProvider(() => {
  const registry = signal<Record<string, FocusElementRegistryEntry>>({});
  const registryOrder = signal<string[]>([]);

  const register = (entry: FocusElementRegistryEntry) => {
    registry.update((current) => {
      current[entry.id] = entry;
      return current;
    });
    registryOrder.update((current) => {
      if (!current.includes(entry.id)) {
        current.push(entry.id);
      }
      return current;
    });
  };

  const unregister = (id: string) => {
    registry.update((current) => {
      delete current[id];
      return current;
    });
    registryOrder.update((current) => {
      const index = current.indexOf(id);
      if (index !== -1) {
        current.splice(index, 1);
      }
      return current;
    });
  };

  const currentFocusTarget = (id: string) =>
    computed(() => {
      const order = registryOrder();
      const last = order[order.length - 1];

      if (!last || order[order.length - 1] !== id) return null;

      return registry()[last] || null;
    });

  return {
    register,
    unregister,
    currentFocusTarget,
  };
});
