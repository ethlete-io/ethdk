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
import { injectParentSurface, ProvideSurfaceDirective } from './provide-surface.directive';
import { injectSurfaceContextTracker } from './surface-context-tracker';
import {
  injectSurfaceThemes,
  RegisteredSurfaceThemeName,
  resolveSurfaceByElevation,
  SurfaceType,
} from './surface-theme.util';

@Directive({
  selector: '[etAutoSurface]',
  hostDirectives: [ProvideSurfaceDirective],
})
export class AutoSurfaceDirective {
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private parentSurface = injectParentSurface();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Explicit surface provider to resolve the surface relative to. Falls back to the
   * surface provider from the surrounding (trigger) context when not set.
   */
  surfaceProvider = input<ProvideSurfaceDirective | null>(null);

  private isOverlaySurface = signal(false);

  // surfaceForElement() reads the DOM non-reactively; bumping this re-runs resolvedSurface after a re-graft.
  private domSettleTick = signal(0);

  resolvedSurface = computed(() => {
    const themes = this.surfaceThemes;

    if (!themes) {
      return null;
    }

    this.domSettleTick();

    const explicitProvider = this.surfaceProvider();
    const contextTheme = explicitProvider ? explicitProvider.activeTheme() : this.parentSurface();
    const contextElevation = contextTheme?.elevation ?? null;
    const contextType = contextTheme?.type ?? null;

    // Portaled content keeps the trigger's injector, so only the pane that contains this element in the DOM counts.
    const overlaySurface = this.surfaceContextTracker.surfaceForElement(this.elementRef.nativeElement);
    const overlayElevation = overlaySurface?.elevation ?? null;
    const overlayType = overlaySurface?.type ?? null;

    // Must not re-derive from the declaration injector: it points at the trigger and would double-elevate the panel.
    if (this.isOverlaySurface()) {
      if (overlayElevation !== null) {
        return resolveSurfaceByElevation(themes, overlayType ?? contextType ?? 'dark', overlayElevation)?.name ?? null;
      }

      if (contextElevation !== null) {
        return resolveSurfaceByElevation(themes, contextType ?? 'dark', contextElevation)?.name ?? null;
      }

      return null;
    }

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
    // The containment check is a plain DOM read, so nothing re-runs resolvedSurface once the element
    // reaches its final pane (windowed lists mount it in an off-pane container first). Watch it across renders.
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
        settleWatcher.destroy();
      }
    });

    effect(() => {
      const surface = this.resolvedSurface();

      untracked(() => {
        setInputSignal(this.ownSurfaceProvider.surface, surface as RegisteredSurfaceThemeName | null);
      });
    });
  }
}
