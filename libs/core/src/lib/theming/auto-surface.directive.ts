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

  // An overlay *panel* that IS its overlay's own painted surface opts in (see
  // matchOverlaySurface) so it adopts the overlay's registered elevation exactly,
  // rather than layering one level above a parent surface.
  private isOverlaySurface = signal(false);

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
    const overlaySurface = this.surfaceContextTracker.surfaceForElement(this.elementRef.nativeElement);
    const overlayElevation = overlaySurface?.elevation ?? null;
    const overlayType = overlaySurface?.type ?? null;

    // A panel that IS its overlay's own surface (see matchOverlaySurface) must paint exactly the
    // overlay's elevation: the overlay container already resolved it (one above the trigger) and
    // registered it in the tracker. It must NOT re-derive from its declaration injector — that
    // points back at the trigger location and disagrees with the pane whenever the trigger itself
    // sits on a surface, which would double-elevate the panel relative to its own pane.
    if (this.isOverlaySurface()) {
      if (overlayElevation !== null) {
        return resolveSurfaceByElevation(themes, overlayType ?? contextType ?? 'dark', overlayElevation)?.name ?? null;
      }

      // Rendered outside any tracked overlay: fall back to the injector context unchanged.
      if (contextElevation !== null) {
        return resolveSurfaceByElevation(themes, contextType ?? 'dark', contextElevation)?.name ?? null;
      }

      return null;
    }

    // A regular auto-surface sits one elevation *above* the deeper of its injector context and the
    // overlay pane it renders into (content painted onto the surface it lives on).
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
   * Mark this auto-surface as its overlay's *own painted surface*. An overlay *panel*
   * (menu, select/date/cascader panel, tooltip, toggletip, rich-text-editor popups) is
   * the overlay's surface, so it must paint the overlay's registered elevation exactly —
   * not stack a level above a parent surface. The elevation is read from the surface-context
   * tracker (the pane it renders into), which is authoritative across the portal boundary;
   * the panel's own declaration injector points back at the trigger location and cannot be
   * trusted.
   */
  matchOverlaySurface() {
    this.isOverlaySurface.set(true);
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
