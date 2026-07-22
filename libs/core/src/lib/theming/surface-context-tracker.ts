import { computed, Signal, signal } from '@angular/core';
import { createRootProvider } from '../utils';
import { SurfaceType } from './surface-theme.util';

export type SurfaceContextEntry = {
  id: string;
  type: SurfaceType;
  elevation: number;
  element: HTMLElement;
};

export type SurfaceContextSurface = {
  type: SurfaceType;
  elevation: number;
};

export type SurfaceContextTracker = {
  topType: Signal<SurfaceType | null>;
  topElevation: Signal<number>;
  register: (type: SurfaceType, elevation: number, element: HTMLElement) => () => void;
  /**
   * The surface of the innermost registered overlay whose pane actually contains `host` in the DOM,
   * or `null` when `host` sits outside every open overlay. Reactive: reads the entries signal, so
   * calling it inside a computed re-runs when overlays open/close.
   */
  surfaceForElement: (host: HTMLElement) => SurfaceContextSurface | null;
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

    const register = (type: SurfaceType, elevation: number, element: HTMLElement) => {
      const id = `surface-ctx-${uniqueId++}`;
      const entry: SurfaceContextEntry = { id, type, elevation, element };
      entries.update((e) => [...e, entry]);

      return () => {
        entries.update((e) => e.filter((item) => item.id !== id));
      };
    };

    const surfaceForElement = (host: HTMLElement): SurfaceContextSurface | null => {
      const stack = entries();

      // Walk newest-first so the innermost overlay containing `host` wins.
      for (let i = stack.length - 1; i >= 0; i--) {
        const entry = stack[i];

        if (entry && entry.element.contains(host)) {
          return { type: entry.type, elevation: entry.elevation };
        }
      }

      return null;
    };

    return { topType, topElevation, register, surfaceForElement };
  },
  { name: 'SurfaceContextTracker' },
);
