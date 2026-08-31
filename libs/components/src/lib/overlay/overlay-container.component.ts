import {
  ApplicationRef,
  Binding,
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  Type,
  ViewContainerRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  SURFACE_PROVIDER,
  SurfaceTheme,
  SurfaceType,
  createCssSurfaceName,
  injectBoundaryElement,
  injectRenderer,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  injectSurfaceThemesPrefix,
  provideBoundaryElement,
  resolveAppRootColorProvider,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { tap } from 'rxjs';
import { OVERLAY_HAS_BACKDROP, resolveOverlayHasBackdrop } from './overlay-has-backdrop';
import { OVERLAY_REF } from './overlay-ref';

@Component({
  selector: 'et-overlay-container',
  templateUrl: './overlay-container.component.html',
  styleUrl: './overlay-container.component.css',
  encapsulation: ViewEncapsulation.None,
  providers: [provideBoundaryElement()],
  hostDirectives: [AnimatedLifecycleDirective, ProvideColorDirective, ProvideSurfaceDirective],
  host: {
    class: 'et-overlay',
    '[class.et-with-default-animation]': '!overlayRef.config.customAnimated',
  },
})
export class OverlayContainerComponent {
  private ownColorProvider = inject(ProvideColorDirective);
  private ownSurfaceProvider = inject(ProvideSurfaceDirective);
  private parentColorProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });
  private parentSurfaceProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private destroyRef = inject(DestroyRef);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private appRef = inject(ApplicationRef);
  private mountedHasBackdrop = inject(OVERLAY_HAS_BACKDROP, { optional: true });

  protected overlayRef = inject(OVERLAY_REF);
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfacePrefix = injectSurfaceThemesPrefix({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private renderer = injectRenderer();

  public rootBoundary = injectBoundaryElement();

  public component = input.required<Type<object>>();
  public componentBindings = input<Binding[] | undefined>(undefined);

  public renderArrow = input(false, { transform: booleanAttribute });
  public renderDragHandle = input(false, { transform: booleanAttribute });

  private contentOutlet = viewChild.required('contentOutlet', { read: ViewContainerRef });
  public animatedLifecycle = signal(inject(ANIMATED_LIFECYCLE_TOKEN));
  public contentComponentRef = signal<ComponentRef<object> | null>(null);

  constructor() {
    // The pane is detached DOM: element DI only reaches a color provider when the opener passed a
    // viewContainerRef/injector. Without one, fall back to the provider on the bootstrapped root
    // component (e.g. added via hostDirectives on the app component) so an app-wide forced color
    // still propagates into overlays.
    const contextColorProvider = this.parentColorProvider ?? resolveAppRootColorProvider(this.appRef);

    if (contextColorProvider) {
      this.ownColorProvider.syncWithProvider(contextColorProvider);
    }

    if (this.surfaceThemes) {
      // Resolve the surface the overlay's trigger visually sits on, so the overlay elevates one
      // level above it. The trigger keeps its *declaration* injector even when projected/portaled
      // into another overlay, so DI (`parentSurfaceProvider`) reports the wrong surface for a
      // trigger rendered inside a dialog/menu pane, and reports nothing for the anchored panel
      // overlays (select/menu/date) which mount with no DI link to the trigger at all. The
      // trigger's nearest painted surface ancestor *in the DOM* is authoritative in every case -
      // an overlay pane and a plain elevated card both carry the surface class - so read that,
      // and fall back to DI (openers that pass a viewContainerRef but no origin).
      const parentSurface = this.resolveOriginSurface() ?? this.parentDiSurface();
      const parentType = parentSurface?.type ?? 'dark';
      // a strategy's own `hasBackdrop` never reaches `overlayRef.config` - only the value the overlay
      // actually mounted with accounts for it
      const hasBackdrop = this.mountedHasBackdrop ?? resolveOverlayHasBackdrop(this.overlayRef.config);
      const elevation = hasBackdrop || !parentSurface ? 1 : parentSurface.elevation + 1;
      const resolved = resolveSurfaceByElevation(this.surfaceThemes, parentType, elevation);

      if (resolved) {
        this.ownSurfaceProvider.forceSurface(resolved.name);
      }

      const unregister = this.surfaceContextTracker.register(parentType, elevation, this.elementRef.nativeElement);
      this.destroyRef.onDestroy(unregister);
    }

    this.rootBoundary.override.set(this.elementRef.nativeElement);

    afterNextRender(() => {
      const host = this.elementRef.nativeElement;

      // A sheet's enter spring briefly overshoots past its docked edge; a box-shadow fills the gap
      // (see the CSS). Its color must match the sheet's *actually painted* surface, which can live
      // on nested content one elevation above the host's own forced surface - so measure the
      // painted pane rather than trusting the host's --et-surface-background-solid token, which
      // would be a shade off. Falls back to the token (CSS default) when nothing paints.
      if (host.classList.contains('et-with-default-animation') && this.isSheetHost(host)) {
        const sheetPane = this.resolvePaintedPaneElement(host);
        const sheetBackground = getComputedStyle(sheetPane).backgroundColor;
        const sheetPaints =
          !!sheetBackground && sheetBackground !== 'transparent' && sheetBackground !== 'rgba(0, 0, 0, 0)';

        if (sheetPaints) {
          this.renderer.setCssProperties(host, { '--_et-overlay-overshoot-fill': sheetBackground });
        }
      }

      if (!this.renderArrow()) return;

      const pane = this.resolvePaintedPaneElement(host);
      const style = getComputedStyle(pane);
      const props: Record<string, string> = {};
      const borderWidth = parseFloat(style.borderTopWidth) || 0;

      const background = style.backgroundColor;
      const panePaints = !!background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)';

      if (panePaints) {
        // continue the pane's background and match its border exactly - including no border at
        // all when the pane has none, so a 0px width is forwarded rather than left to the fallback
        props['--_et-overlay-arrow-pane-background'] = background;
        props['--_et-overlay-arrow-pane-border-width'] = `${borderWidth}px`;
        props['--_et-overlay-arrow-pane-border-color'] = borderWidth ? style.borderTopColor : 'transparent';
      } else if (borderWidth) {
        // no painted pane found: only forward a real border and let the surface-token fallback
        // fill the background
        props['--_et-overlay-arrow-pane-border-width'] = `${borderWidth}px`;
        props['--_et-overlay-arrow-pane-border-color'] = style.borderTopColor;
      }

      if (Object.keys(props).length) {
        this.renderer.setCssProperties(host, props);
      }
    });

    this.animatedLifecycle()
      .state$.pipe(
        tap((state) => {
          const backdrop = this.overlayRef.elements?.backdropElement();
          if (!backdrop) return;

          if (state === 'entering' || state === 'entered') {
            this.renderer.addClass(backdrop, 'et-overlay-backdrop--visible');
          } else if (state === 'leaving' || state === 'left') {
            this.renderer.removeClass(backdrop, 'et-overlay-backdrop--visible');
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const outlet = this.contentOutlet();
      const component = this.component();

      untracked(() => {
        this.contentComponentRef()?.destroy();

        const componentRef = outlet.createComponent(component, {
          bindings: this.componentBindings() ?? [],
        });

        this.contentComponentRef.set(componentRef);
      });
    });

    this.destroyRef.onDestroy(() => this.contentComponentRef()?.destroy());
  }

  /**
   * The element whose surface the container should visually continue (for the arrow's background
   * and the sheet overshoot filler): the host itself when it paints the pane (custom panelClass,
   * dialog), otherwise the first painted element in the rendered content (menu/tooltip/date-picker
   * paint a nested element, potentially at a higher elevation than the host's forced surface).
   */
  private parentDiSurface(): { elevation: number; type: SurfaceType } | null {
    const provider = this.parentSurfaceProvider;

    if (!provider) return null;

    return { elevation: provider.elevation(), type: provider.surfaceType() ?? 'dark' };
  }

  /**
   * The surface of the nearest ancestor of the overlay's origin (trigger) that paints a resolved
   * surface - walking the real DOM so it sees *through* the portal/projection boundary that hides
   * the true parent surface from DI. Returns null when there is no origin element or no surfaced
   * ancestor (the overlay then falls back to DI, and ultimately to elevation 1).
   */
  private resolveOriginSurface(): { elevation: number; type: SurfaceType } | null {
    const themes = this.surfaceThemes;

    if (!themes) return null;

    const origin = this.resolveOriginElement();

    if (!origin) return null;

    const prefix = this.surfacePrefix || 'et';
    const themeByClass = new Map<string, SurfaceTheme>();

    for (const theme of themes) {
      themeByClass.set(`${prefix}-surface--${createCssSurfaceName(theme.name)}`, theme);
    }

    for (let el: HTMLElement | null = origin; el; el = el.parentElement) {
      for (const cls of Array.from(el.classList)) {
        const theme = themeByClass.get(cls);

        if (theme) return { elevation: theme.elevation, type: theme.type };
      }
    }

    return null;
  }

  private resolveOriginElement(): HTMLElement | null {
    const origin = this.overlayRef.config.origin;

    if (origin instanceof HTMLElement) return origin;

    if (origin instanceof Event) {
      const target = origin.target ?? origin.currentTarget;

      return target instanceof HTMLElement ? target : null;
    }

    return null;
  }

  private isSheetHost(host: HTMLElement) {
    return (
      host.classList.contains('et-overlay--bottom-sheet') ||
      host.classList.contains('et-overlay--top-sheet') ||
      host.classList.contains('et-overlay--left-sheet') ||
      host.classList.contains('et-overlay--right-sheet')
    );
  }

  private resolvePaintedPaneElement(host: HTMLElement): HTMLElement {
    const isPainted = (el: HTMLElement) => {
      const background = getComputedStyle(el).backgroundColor;
      return !!background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)';
    };

    if (isPainted(host)) return host;

    const content = this.contentComponentRef()?.location.nativeElement as HTMLElement | undefined;
    if (!content) return host;
    if (isPainted(content)) return content;

    // the painted pane varies per overlay kind (.et-menu, .et-tooltip__surface, …) with no
    // shared hook, so scan the rendered content for the first element that actually paints
    // eslint-disable-next-line ethlete/no-dom-query -- one-off measurement in afterNextRender; no stable directive hook across overlay kinds
    for (const el of Array.from(content.querySelectorAll<HTMLElement>('*'))) {
      if (isPainted(el)) return el;
    }

    return host;
  }
}
