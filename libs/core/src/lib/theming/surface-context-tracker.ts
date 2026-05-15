import { computed, Signal, signal } from '@angular/core';
import { createRootProvider } from '../utils';
import { SurfaceType } from './surface-theme.util';

export type SurfaceContextEntry = {
  id: string;
  type: SurfaceType;
  elevation: number;
};

export type SurfaceContextTracker = {
  topType: Signal<SurfaceType | null>;
  topElevation: Signal<number>;
  register: (type: SurfaceType, elevation: number) => () => void;
};

let uniqueId = 0;

export const [provideSurfaceContextTracker, injectSurfaceContextTracker] = createRootProvider(
  (): SurfaceContextTracker => {
    const entries = signal<SurfaceContextEntry[]>([]);

    const topEntry = computed(() => {
      const stack = entries();
      return stack.length > 0 ? (stack[stack.length - 1] ?? null) : null;
    });

    const topType = computed(() => topEntry()?.type ?? null);
    const topElevation = computed(() => topEntry()?.elevation ?? 0);

    const register = (type: SurfaceType, elevation: number) => {
      const id = `surface-ctx-${uniqueId++}`;
      const entry: SurfaceContextEntry = { id, type, elevation };
      entries.update((e) => [...e, entry]);

      return () => {
        entries.update((e) => e.filter((item) => item.id !== id));
      };
    };

    return { topType, topElevation, register };
  },
  { name: 'SurfaceContextTracker' },
);
