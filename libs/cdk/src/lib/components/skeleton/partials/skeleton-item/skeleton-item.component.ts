import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-skeleton-item',
  template: ``,
  styleUrls: ['skeleton-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton-item',
    'aria-hidden': 'true',
  },
})
export class SkeletonItemComponent {}
