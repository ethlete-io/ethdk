import {
  afterEveryRender,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
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

  // Bumped by the afterEveryRender watcher in the constructor whenever this element's overlay
  // containment changes. surfaceForElement() below does a non-reactive element.contains() read,
  // so the computed must be re-triggered when this element is (re)grafted into an overlay pane -
  // otherwise a value cached from before the graft (one elevation too low) sticks forever.
  private domSettleTick = signal(0);

  resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;

    if (!themes) {
      return null;
    }

    // Establish a dependency on the DOM-settle tick so the non-reactive containment read below
    // is re-evaluated after the element is grafted into its final overlay pane.
    this.domSettleTick();

    const contextProvider = this.surfaceProvider() ?? this.contextSurfaceProvider ?? null;
    const contextElevation = contextProvider?.elevation() ?? null;
    const contextType = contextProvider?.surfaceType() ?? null;

    // An overlay's projected/portaled content keeps the injector of where it was
    // *declared* (the trigger location), not the pane it renders into - so the
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
    // registered it in the tracker. It must NOT re-derive from its declaration injector - that
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
   * the overlay's surface, so it must paint the overlay's registered elevation exactly -
   * not stack a level above a parent surface. The elevation is read from the surface-context
   * tracker (the pane it renders into), which is authoritative across the portal boundary;
   * the panel's own declaration injector points back at the trigger location and cannot be
   * trusted.
   */
  matchOverlaySurface() {
    this.isOverlaySurface.set(true);
  }

  constructor() {
    // Projected/portaled auto-surface content (e.g. a select option's avatar) can have its
    // resolvedSurface computed run *before* it is grafted into the overlay pane it visually lives
    // in - or while it is briefly mounted in an off-pane measuring container, as windowed lists do.
    // surfaceForElement()'s element.contains() check then returns the wrong (or no) overlay, so it
    // resolves off the declaration injector (the trigger location) one elevation too low. That check
    // is a plain DOM read, not a signal, so nothing re-runs the computed once the element reaches its
    // final pane. Watch the tracker result across renders and re-trigger the computed whenever the
    // element's overlay containment changes, settling (and unsubscribing) once it stops moving.
    let lastElevation: number | null =
      this.surfaceContextTracker.surfaceForElement(this.elementRef.nativeElement)?.elevation ?? null;
    let stableRenders = 0;
    const settleWatcher = afterEveryRender(() => {
      const el = this.elementRef.nativeElement;
      const elevation = this.surfaceContextTracker.surfaceForElement(el)?.elevation ?? null;

      if (elevation !== lastElevation) {
        lastElevation = elevation;
        stableRenders = 0;
        this.domSettleTick.update((v) => v + 1);
      } else if (el.isConnected && ++stableRenders >= 2) {
        // containment has held for a couple of renders and the element is in the DOM - done moving
        settleWatcher.destroy();
      }
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.ownSurfaceProvider.surface as any, surface);
      });
    });
  }
}
