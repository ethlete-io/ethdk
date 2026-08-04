import { Component, ViewEncapsulation, booleanAttribute, contentChildren, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, map, pairwise, switchMap, tap } from 'rxjs';

import { ACCORDION_COMPONENT } from '../accordion';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-accordion-group',
  templateUrl: './accordion-group.component.html',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-accordion-group et-legacy',
  },
})
export class AccordionGroupComponent {
  autoCloseOthers = input(false, { transform: booleanAttribute });

  accordions = contentChildren(ACCORDION_COMPONENT);

  constructor() {
    toObservable(this.accordions)
      .pipe(
        map((accordions) => accordions.map((a) => a.isOpen$)),
        switchMap((d) => combineLatest(d)),
        pairwise(),
        tap(([prev, curr]) => {
          if (!this.autoCloseOthers()) {
            return;
          }

          const isOpenedNow = curr.findIndex((a, i) => a && !prev[i]);

          if (isOpenedNow === -1) {
            return;
          }

          for (const [i, item] of this.accordions().entries()) {
            if (i !== isOpenedNow && item.isOpen()) {
              item.close();
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
