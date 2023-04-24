import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { SkeletonComponent } from '../../components';
import { SkeletonItemComponent } from '../../partials';

@Component({
  selector: 'et-sb-skeleton',
  template: `
    <et-skeleton [loadingAllyText]="loadingAllyText" [animated]="animated">
      <et-skeleton-item></et-skeleton-item>
      <et-skeleton-item></et-skeleton-item>
      <et-skeleton-item></et-skeleton-item>
    </et-skeleton>
  `,
  styles: [
    `
      et-skeleton {
        background-color: #343434;
        width: 315px;
        padding: 16px;
        border-radius: 8px;
      }

      et-skeleton-item {
        background-color: #555555;
      }

      et-skeleton-item:nth-of-type(1) {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        margin-bottom: 60px;
      }

      et-skeleton-item:nth-of-type(2) {
        width: 60%;
        height: 24px;
        margin-bottom: 16px;
        border-radius: 4px;
      }

      et-skeleton-item:nth-of-type(3) {
        width: 100%;
        height: 24px;
        border-radius: 4px;
      }
    `,
  ],
  standalone: true,
  imports: [SkeletonComponent, SkeletonItemComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonStorybookComponent {
  @Input()
  loadingAllyText = 'Loading...';

  @Input()
  animated = true;
}
