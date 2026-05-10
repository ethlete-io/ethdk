import { computed, Signal, signal } from '@angular/core';
import { createRootProvider } from '../utils';
import { SurfaceType } from './surface-theme.util';

export type SurfaceContextEntry = {
  id: string;
  type: SurfaceType;
  elevation: number;
  neutralColor: string | null;
};

export type SurfaceContextTracker = {
  topType: Signal<SurfaceType | null>;
  topElevation: Signal<number>;
  topNeutralColor: Signal<string | null>;
  register: (type: SurfaceType, elevation: number, neutralColor?: string | null) => () => void;
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
    const topNeutralColor = computed(() => topEntry()?.neutralColor ?? null);

    const register = (type: SurfaceType, elevation: number, neutralColor?: string | null) => {
      const id = `surface-ctx-${uniqueId++}`;
      const entry: SurfaceContextEntry = { id, type, elevation, neutralColor: neutralColor ?? null };
      entries.update((e) => [...e, entry]);

      return () => {
        entries.update((e) => e.filter((item) => item.id !== id));
      };
    };

    return { topType, topElevation, topNeutralColor, register };
  },
  { name: 'SurfaceContextTracker' },
);
