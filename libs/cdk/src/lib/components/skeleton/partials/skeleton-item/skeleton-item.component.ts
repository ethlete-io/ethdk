import { Component, ViewEncapsulation } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-skeleton-item',
  template: ``,
  styleUrls: ['skeleton-item.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton-item et-legacy',
    'aria-hidden': 'true',
  },
})
export class SkeletonItemComponent {}
