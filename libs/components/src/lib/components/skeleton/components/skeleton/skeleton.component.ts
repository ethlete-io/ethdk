import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText }} </span> <ng-content></ng-content>`,
  styleUrls: ['skeleton.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class SkeletonComponent {
  @Input()
  loadingAllyText = 'Loading...';
}
