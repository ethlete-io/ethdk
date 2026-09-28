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
  computed,
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
import { OverlayConfig } from './overlay-config';
import { OVERLAY_HAS_BACKDROP, resolveOverlayHasBackdrop } from './overlay-has-backdrop';
import { OVERLAY_REF } from './overlay-ref';

const PAINTED_PANE_MAX_DEPTH = 4;

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
  public componentDirectives = input<OverlayConfig['directives'] | undefined>(undefined);

  public renderArrow = input(false, { transform: booleanAttribute });
  public renderDragHandle = input(false, { transform: booleanAttribute });

  private contentOutlet = viewChild.required('contentOutlet', { read: ViewContainerRef });
  public animatedLifecycle = signal(inject(ANIMATED_LIFECYCLE_TOKEN));
  public contentComponentRef = signal<ComponentRef<object> | null>(null);

  constructor() {
    const contextColorProvider = this.parentColorProvider ?? resolveAppRootColorProvider(this.appRef);

    if (contextColorProvider) {
      this.ownColorProvider.syncWithProvider(contextColorProvider);
    }

    if (this.surfaceThemes) {
      const parentSurface = this.resolveOriginSurface() ?? this.parentDiSurface();
      const parentType = parentSurface?.type ?? 'dark';
      const surfaceThemes = this.surfaceThemes;
      const hasBackdrop = computed(
        () => this.mountedHasBackdrop?.() ?? resolveOverlayHasBackdrop(this.overlayRef.config),
      );
      const elevation = computed(() => (hasBackdrop() || !parentSurface ? 1 : parentSurface.elevation + 1));
      let unregister: (() => void) | null = null;

      const applyElevation = (level: number) => {
        const resolved = resolveSurfaceByElevation(surfaceThemes, parentType, level);

        if (resolved) {
          this.ownSurfaceProvider.forceSurface(resolved.name);
        }

        unregister?.();
        unregister = this.surfaceContextTracker.register(parentType, level, this.elementRef.nativeElement);
      };

      let appliedElevation = untracked(elevation);

      applyElevation(appliedElevation);

      effect(() => {
        const level = elevation();

        if (level === appliedElevation) return;

        appliedElevation = level;
        untracked(() => applyElevation(level));
      });

      this.destroyRef.onDestroy(() => unregister?.());
    }

    this.rootBoundary.override.set(this.elementRef.nativeElement);

    afterNextRender(() => {
      const host = this.elementRef.nativeElement;

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
        props['--_et-overlay-arrow-pane-background'] = background;
        props['--_et-overlay-arrow-pane-border-width'] = `${borderWidth}px`;
        props['--_et-overlay-arrow-pane-border-color'] = borderWidth ? style.borderTopColor : 'transparent';
      } else if (borderWidth) {
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
          directives: this.componentDirectives() ?? [],
        });

        this.contentComponentRef.set(componentRef);
      });
    });

    this.destroyRef.onDestroy(() => this.contentComponentRef()?.destroy());
  }

  private parentDiSurface(): { elevation: number; type: SurfaceType } | null {
    const provider = this.parentSurfaceProvider;

    if (!provider) return null;

    return { elevation: provider.elevation(), type: provider.surfaceType() ?? 'dark' };
  }

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

    for (let el: Element | null = origin; el; el = el.parentElement) {
      for (const cls of Array.from(el.classList)) {
        const theme = themeByClass.get(cls);

        if (theme) return { elevation: theme.elevation, type: theme.type };
      }
    }

    return null;
  }

  private resolveOriginElement(): Element | null {
    const origin = this.overlayRef.config.origin;

    if (origin instanceof Element) return origin;

    if (origin instanceof Event) {
      const target = origin.target ?? origin.currentTarget;

      return target instanceof Element ? target : null;
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

    const findPainted = (parent: Element, depth: number): HTMLElement | null => {
      if (depth > PAINTED_PANE_MAX_DEPTH) return null;

      for (const child of Array.from(parent.children)) {
        if (child instanceof HTMLElement && isPainted(child)) return child;

        const painted = findPainted(child, depth + 1);

        if (painted) return painted;
      }

      return null;
    };

    return findPainted(content, 1) ?? host;
  }
}
