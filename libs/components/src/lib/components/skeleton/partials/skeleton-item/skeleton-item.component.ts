import { ChangeDetectionStrategy, Component, HostBinding, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-skeleton-item',
  template: ``,
  styleUrls: ['skeleton-item.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class SkeletonItemComponent {
  @HostBinding('attr.aria-hidden')
  ariaHidden = true;
}
