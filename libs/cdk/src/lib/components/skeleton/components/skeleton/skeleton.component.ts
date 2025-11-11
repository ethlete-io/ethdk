import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Input,
  ViewEncapsulation,
  booleanAttribute,
} from '@angular/core';

@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText }} </span> <ng-content />`,
  styleUrls: ['skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
  },
})
export class SkeletonComponent {
  @Input()
  loadingAllyText = 'Loading...';

  @Input({ transform: booleanAttribute })
  @HostBinding('class.et-skeleton--animated')
  animated = true;
}
