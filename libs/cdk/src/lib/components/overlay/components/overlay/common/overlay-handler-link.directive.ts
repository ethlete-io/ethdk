import { Directive, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etOverlayHandlerLink]',
  hostDirectives: [RouterLink],
})
export class OverlayHandlerLinkDirective {
  private readonly _routerLink = inject(RouterLink);

  linkValue = input.required<string | number>({ alias: 'etOverlayHandlerLink' });
  linkKey = input.required<string>({ alias: 'etOverlayHandlerQueryParamName' });

  constructor() {
    this._routerLink.routerLink = [];
    this._routerLink.queryParamsHandling = 'merge';

    effect(() => {
      const linkValue = this.linkValue();
      const linkKey = this.linkKey();

      untracked(() => {
        this._routerLink.queryParams = {
          [linkKey]: linkValue,
        };
      });
    });
  }
}
