import { computed, Directive, effect, inject, input, untracked } from '@angular/core';
import { setInputSignal } from '../utils';
import { ProvideSurfaceDirective, SURFACE_PROVIDER } from './provide-surface.directive';
import { injectSurfaceThemes, resolveSurfaceByElevation } from './surface-theme.util';

@Directive({
  selector: '[etAutoSurface]',
  hostDirectives: [ProvideSurfaceDirective],
})
export class AutoSurfaceDirective {
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private contextSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private surfaceThemes = injectSurfaceThemes({ optional: true });

  /**
   * Explicit surface provider to resolve the surface relative to. Falls back to the
   * surface provider from the surrounding (trigger) context when not set.
   */
  surfaceProvider = input<ProvideSurfaceDirective | null>(null);

  resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;
    const parentSurfaceProvider = this.surfaceProvider() ?? this.contextSurfaceProvider ?? null;

    if (!themes || !parentSurfaceProvider) {
      return null;
    }

    return (
      resolveSurfaceByElevation(
        themes,
        parentSurfaceProvider.surfaceType() ?? 'dark',
        parentSurfaceProvider.elevation() + 1,
      )?.name ?? null
    );
  });

  constructor() {
    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInputSignal(this.ownSurfaceProvider.surface as any, surface);
      });
    });
  }
}
