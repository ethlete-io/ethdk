import { Directive, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

@Directive({
  selector: '[etOverlayHandlerLink]',
  hostDirectives: [RouterLink],
})
export class OverlayHandlerLinkDirective {
  private routerLink = inject(RouterLink);

  public linkValue = input.required<string | number>({ alias: 'etOverlayHandlerLink' });
  public linkKey = input.required<string>({ alias: 'etOverlayHandlerQueryParamName' });

  constructor() {
    this.routerLink.routerLink = [];
    this.routerLink.queryParamsHandling = 'merge';

    effect(() => {
      const linkValue = this.linkValue();
      const linkKey = this.linkKey();

      untracked(() => {
        this.routerLink.queryParams = { [linkKey]: linkValue };
      });
    });
  }
}
