import { computed, Directive, effect, inject, input, untracked } from '@angular/core';
import { setInputSignal } from '../utils';
import { ProvideSurfaceDirective, SURFACE_PROVIDER } from './provide-surface.directive';
import { injectSurfaceThemes, resolveSurfaceByElevation } from './surface-theme.util';

/**
 * Auto-resolves a surface theme one elevation above its parent surface context and
 * applies it through a host `ProvideSurfaceDirective`.
 *
 * Meant to be applied as a host directive on components that render inside a detached
 * overlay pane (tooltip, toggletip, …), where the surface context can't cascade through
 * the DOM and has to be re-derived from the trigger's surface provider.
 */
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
        setInputSignal(this.ownSurfaceProvider.surface, surface);
      });
    });
  }
}
