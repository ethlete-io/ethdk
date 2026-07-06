import { Directive, ElementRef, InjectionToken, booleanAttribute, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRouterNavigationDirection, injectOverlayRouter } from './overlay-router';

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
    '[class.et-overlay-router-link--active]': 'isActive()',
  },
})
export class OverlayRouterLinkDirective {
  private elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);
  private router = injectOverlayRouter();
  public path = input.required<string | (string | number)[]>({ alias: 'etOverlayRouterLink' });
  public disabled = input(false, { transform: booleanAttribute });
  public navigationDirection = input<OverlayRouterNavigationDirection | null>(null);

  public isActive = computed(() => this.router.resolvePath(this.path()).route === this.router.currentRoute());

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
