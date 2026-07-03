import { Directive, ElementRef, InjectionToken, booleanAttribute, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRouterNavigationDirection, OverlayRouterService } from './overlay-router';

export const OVERLAY_ROUTER_LINK_TOKEN = new InjectionToken<OverlayRouterLinkDirective>('OVERLAY_ROUTER_LINK_TOKEN');

@Directive({
  selector: '[etOverlayRouterLink]',
  providers: [
    {
      provide: OVERLAY_ROUTER_LINK_TOKEN,
      useExisting: OverlayRouterLinkDirective,
    },
  ],
  host: {
    class: 'et-overlay-router-link',
    type: 'button',
    '[attr.aria-current]': "isActive() ? 'page' : null",
    '[attr.aria-disabled]': 'disabled() || null',
  },
})
export class OverlayRouterLinkDirective {
  private router = inject(OverlayRouterService);
  private elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  public path = input.required<string | (string | number)[]>({ alias: 'etOverlayRouterLink' });
  public disabled = input(false, { transform: booleanAttribute });
  public navigationDirection = input<OverlayRouterNavigationDirection | null>(null);

  public isActive = computed(() => this.router.resolvePath(this.path()).route === this.router.currentRoute());

  public hostClassBindings = signalHostClasses({
    'et-overlay-router-link--active': this.isActive,
  });

  constructor() {
    fromEvent<PointerEvent>(this.elementRef.nativeElement, 'click')
      .pipe(
        filter(() => !this.disabled()),
        tap(() => this.router.navigate(this.path(), { navigationDirection: this.navigationDirection() ?? undefined })),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
