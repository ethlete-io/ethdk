import { Directive, ElementRef, InjectionToken, booleanAttribute, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { signalHostClasses } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { OverlayRouterNavigationDirection, OverlayRouterService } from './overlay-router';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const OVERLAY_ROUTER_LINK_TOKEN = new InjectionToken<OverlayRouterLinkDirective>('OVERLAY_ROUTER_LINK_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etOverlayRouterLink]',
  providers: [
    {
      provide: OVERLAY_ROUTER_LINK_TOKEN,
      useExisting: OverlayRouterLinkDirective,
    },
  ],
  host: {
    class: 'et-overlay-router-link et-legacy',
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
