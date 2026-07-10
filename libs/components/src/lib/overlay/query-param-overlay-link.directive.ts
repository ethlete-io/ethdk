import { Directive, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QueryParamOverlayDefinition } from './overlay-definition';

/**
 * Opens a query-param overlay declaratively by navigating its query param — the counterpart to
 * `createOverlayOpener` for links. Takes the overlay definition itself, so the query param key
 * is never duplicated as a string.
 *
 * @example
 * <a [etQueryParamOverlayLink]="productOverlay" etQueryParamOverlayLinkValue="42">Open product 42</a>
 */
@Directive({
  selector: '[etQueryParamOverlayLink]',
  hostDirectives: [RouterLink],
})
export class QueryParamOverlayLinkDirective {
  private routerLink = inject(RouterLink);

  /** The query-param overlay definition this link opens. */
  public definition = input.required<Pick<QueryParamOverlayDefinition, 'queryParamKey'>>({
    alias: 'etQueryParamOverlayLink',
  });

  /** The query param value the overlay opens with. */
  public value = input.required<string | number>({ alias: 'etQueryParamOverlayLinkValue' });

  constructor() {
    this.routerLink.routerLink = [];
    this.routerLink.queryParamsHandling = 'merge';

    effect(() => {
      const definition = this.definition();
      const value = this.value();

      untracked(() => {
        this.routerLink.queryParams = { [definition.queryParamKey]: value };
      });
    });
  }
}
