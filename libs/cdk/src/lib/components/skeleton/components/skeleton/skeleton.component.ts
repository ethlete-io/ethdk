import { Component, ViewEncapsulation, booleanAttribute, input } from '@angular/core';

@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText() }} </span> <ng-content />`,
  styleUrls: ['skeleton.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
    '[class.et-skeleton--animated]': 'animated()',
  },
})
export class SkeletonComponent {
  readonly loadingAllyText = input('Loading...');

  readonly animated = input(true, { transform: booleanAttribute });
}
