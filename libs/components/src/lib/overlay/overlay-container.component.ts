import {
  Binding,
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  Type,
  ViewContainerRef,
  ViewEncapsulation,
  afterNextRender,
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
  injectBoundaryElement,
  injectRenderer,
  injectSurfaceContextTracker,
  injectSurfaceThemes,
  provideBoundaryElement,
  resolveSurfaceByElevation,
} from '@ethlete/core';
import { tap } from 'rxjs';
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

  protected overlayRef = inject(OVERLAY_REF);
  private surfaceThemes = injectSurfaceThemes({ optional: true });
  private surfaceContextTracker = injectSurfaceContextTracker();
  private renderer = injectRenderer();

  public rootBoundary = injectBoundaryElement();

  public component = input.required<Type<object>>();
  public componentBindings = input<Binding[] | undefined>(undefined);

  public renderArrow = input(false);

  private contentOutlet = viewChild.required('contentOutlet', { read: ViewContainerRef });
  public animatedLifecycle = signal(inject(ANIMATED_LIFECYCLE_TOKEN));
  public contentComponentRef = signal<ComponentRef<object> | null>(null);

  constructor() {
    if (this.parentColorProvider) {
      this.ownColorProvider.syncWithProvider(this.parentColorProvider);
    }

    if (this.surfaceThemes) {
      const parentType = this.parentSurfaceProvider?.surfaceType() ?? 'dark';
      const hasBackdrop = this.overlayRef.config.hasBackdrop ?? this.overlayRef.config.mode !== 'non-modal';
      const elevation = hasBackdrop || !this.parentSurfaceProvider ? 1 : this.parentSurfaceProvider.elevation() + 1;
      const resolved = resolveSurfaceByElevation(this.surfaceThemes, parentType, elevation);

      if (resolved) {
        this.ownSurfaceProvider.forceSurface(resolved.name);
      }

      const unregister = this.surfaceContextTracker.register(parentType, elevation);
      this.destroyRef.onDestroy(unregister);
    }

    this.rootBoundary.override.set(this.elementRef.nativeElement);

    afterNextRender(() => {
      if (!this.renderArrow()) return;

      const host = this.elementRef.nativeElement;
      const style = getComputedStyle(host);
      const props: Record<string, string> = {};
      const borderWidth = parseFloat(style.borderTopWidth) || 0;

      const background = style.backgroundColor;
      const hostPaintsPane = !!background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)';

      if (hostPaintsPane) {
        // the host itself is the visible pane (custom panelClass, dialog): the arrow must
        // continue its background and match its border exactly — including no border at all
        // when the pane has none, so a 0px width is forwarded rather than left to the fallback
        props['--_et-overlay-arrow-pane-background'] = background;
        props['--_et-overlay-arrow-pane-border-width'] = `${borderWidth}px`;
        props['--_et-overlay-arrow-pane-border-color'] = borderWidth ? style.borderTopColor : 'transparent';
      } else if (borderWidth) {
        // transparent host: background/border live on an inner element (tooltip/toggletip/menu)
        // and the surface-token fallback fills the rest — only forward a real host border
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
          const backdrop = this.overlayRef.elements?.backdropElement;
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
}
