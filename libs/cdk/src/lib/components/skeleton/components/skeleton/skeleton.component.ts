import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  ViewEncapsulation,
  booleanAttribute,
  input,
} from '@angular/core';

@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText() }} </span> <ng-content />`,
  styleUrls: ['skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
  },
})
export class SkeletonComponent {
  readonly loadingAllyText = input('Loading...');

  @HostBinding('class.et-skeleton--animated')
  readonly animated = input(true, { transform: booleanAttribute });
}
