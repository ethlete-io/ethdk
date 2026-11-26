import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText() }} </span> <ng-content />`,
  styleUrls: ['skeleton.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton et-legacy',
    '[class.et-skeleton--animated]': 'animated()',
  },
})
export class SkeletonComponent {
  readonly loadingAllyText = input('Loading...');

  readonly animated = input(true, { transform: booleanAttribute });
}
