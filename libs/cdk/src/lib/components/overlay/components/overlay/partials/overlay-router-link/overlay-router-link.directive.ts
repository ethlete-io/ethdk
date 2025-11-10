import { Directive, ElementRef, InjectionToken, booleanAttribute, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRouterNavigationDirection, OverlayRouterService } from '../../utils';

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
  },
})
export class OverlayRouterLinkDirective {
  router = inject(OverlayRouterService);
  path = input.required<string | (string | number)[]>({ alias: 'etOverlayRouterLink' });
  disabled = input(false, { transform: booleanAttribute });
  navigationDirection = input<OverlayRouterNavigationDirection | null>(null);

  hostClassBindings = signalHostClasses({
    'et-overlay-router-link--active': computed(
      () => this.router.resolvePath(this.path()).route === this.router.currentRoute(),
    ),
  });

  constructor() {
    fromEvent<PointerEvent>(inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement, 'click')
      .pipe(
        filter(() => !this.disabled()),
        tap(() => this.router.navigate(this.path(), { navigationDirection: this.navigationDirection() ?? undefined })),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
