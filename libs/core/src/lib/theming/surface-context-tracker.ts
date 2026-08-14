import { signal } from '@angular/core';
import { defineRootProvider, toInjectFn, toProvideFn } from '../utils';
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
  register: (type: SurfaceType, elevation: number, element: HTMLElement) => () => void;
  /**
   * The surface of the innermost registered overlay whose pane actually contains `host` in the DOM,
   * or `null` when `host` sits outside every open overlay. Reactive: reads the entries signal, so
   * calling it inside a computed re-runs when overlays open/close.
   */
  surfaceForElement: (host: HTMLElement) => SurfaceContextSurface | null;
};

let uniqueId = 0;

const SURFACE_CONTEXT_TRACKER_DEF = /* @__PURE__ */ defineRootProvider(
  (): SurfaceContextTracker => {
    const entries = signal<SurfaceContextEntry[]>([]);

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

    return { register, surfaceForElement };
  },
  { name: 'SurfaceContextTracker' },
);

export const provideSurfaceContextTracker = /* @__PURE__ */ toProvideFn(SURFACE_CONTEXT_TRACKER_DEF);
export const injectSurfaceContextTracker = /* @__PURE__ */ toInjectFn(SURFACE_CONTEXT_TRACKER_DEF);
