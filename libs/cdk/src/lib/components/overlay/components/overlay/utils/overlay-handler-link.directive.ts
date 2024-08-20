import { Directive, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

@Directive({
  selector: '[etOverlayHandlerLink]',
  standalone: true,
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
