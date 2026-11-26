import { Component, ViewEncapsulation } from '@angular/core';
import { SKELETON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-skeleton-default-example',
  template: `
    <et-skeleton class="example-skeleton">
      <div class="example-skeleton-header">
        <et-skeleton-item class="example-skeleton-avatar" shape="circle" />
        <et-skeleton-text [lines]="2" />
      </div>
      <et-skeleton-item class="example-skeleton-block" shape="rect" />
    </et-skeleton>

    <p class="example-skeleton-copy">
      Real text, then <et-skeleton-item class="example-skeleton-inline" shape="text" /> in the middle of it.
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
  styles: `
    .example-skeleton {
      max-inline-size: 420px;
    }

    .example-skeleton-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .example-skeleton-avatar {
      --et-skeleton-size: 40px;
    }

    .example-skeleton-block {
      block-size: 140px;
      --et-skeleton-radius: 12px;
    }

    .example-skeleton-copy {
      max-inline-size: 420px;
    }

    .example-skeleton-inline {
      max-inline-size: 120px;
    }
  `,
})
export class SkeletonDefaultExampleComponent {}
