import { computed, Directive, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';
import { setInputSignal } from '../utils';
import { ProvideSurfaceDirective, SURFACE_PROVIDER } from './provide-surface.directive';
import { injectSurfaceContextTracker } from './surface-context-tracker';
import { injectSurfaceThemes, resolveSurfaceByElevation, SurfaceType } from './surface-theme.util';

@Directive({
  selector: '[etAutoSurface]',
  hostDirectives: [ProvideSurfaceDirective],
})
export class AutoSurfaceDirective {
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private contextSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Explicit surface provider to resolve the surface relative to. Falls back to the
   * surface provider from the surrounding (trigger) context when not set.
   */
  surfaceProvider = input<ProvideSurfaceDirective | null>(null);

  // Overlay panels that ARE their overlay's own surface opt out (see
  // ignoreOverlaySurfaceContext) so they adopt the overlay elevation from their
  // injector/explicit context instead of stacking one level above it.
  private consultsOverlayContext = signal(true);

  resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;

    if (!themes) {
      return null;
    }

    const contextProvider = this.surfaceProvider() ?? this.contextSurfaceProvider ?? null;
    const contextElevation = contextProvider?.elevation() ?? null;
    const contextType = contextProvider?.surfaceType() ?? null;

    // An overlay's projected/portaled content keeps the injector of where it was
    // *declared* (the trigger location), not the pane it renders into — so the
    // injector-derived parent surface is one elevation too low. The surface-context
    // tracker records each open overlay's surface *and* its pane element, so we consult
    // only the overlay whose pane actually contains this element in the DOM (portaling
    // moves the DOM into the pane even though the injector stays at the trigger). An
    // auto-surface on the base page therefore stays put when an overlay opens elsewhere.
    // Panels that are themselves the overlay's surface opt out via ignoreOverlaySurfaceContext().
    const overlaySurface = this.consultsOverlayContext()
      ? this.surfaceContextTracker.surfaceForElement(this.elementRef.nativeElement)
      : null;
    const overlayElevation = overlaySurface?.elevation ?? null;
    const overlayType = overlaySurface?.type ?? null;

    let parentElevation: number;
    let parentType: SurfaceType;

    if (overlayElevation !== null && (contextElevation === null || overlayElevation > contextElevation)) {
      parentElevation = overlayElevation;
      parentType = overlayType ?? contextType ?? 'dark';
    } else if (contextElevation !== null) {
      parentElevation = contextElevation;
      parentType = contextType ?? overlayType ?? 'dark';
    } else {
      return null;
    }

    return resolveSurfaceByElevation(themes, parentType, parentElevation + 1)?.name ?? null;
  });

  /**
   * Opt this auto-surface out of the overlay surface-context tracker. An overlay
   * *panel* (menu, select/date/cascader panel, tooltip, toggletip) is its overlay's
   * own painted surface, so it must adopt the overlay elevation from its injector or
   * explicit `surfaceProvider` — not stack a level above it. The tracker exists for
   * content rendered *inside* such a panel, whose injector points back at the trigger
   * location and therefore cannot see the overlay it visually lives in.
   */
  ignoreOverlaySurfaceContext() {
    this.consultsOverlayContext.set(false);
  }

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
