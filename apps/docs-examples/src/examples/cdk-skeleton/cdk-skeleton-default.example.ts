import { Component, ViewEncapsulation } from '@angular/core';
import { SkeletonImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-skeleton-default-example',
  template: `
    <et-skeleton class="example-skeleton" loadingAllyText="Loading article…">
      <et-skeleton-item class="example-avatar" />
      <et-skeleton-item class="example-headline" />
      <et-skeleton-item class="example-line" />
    </et-skeleton>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SkeletonImports],
  styles: `
    .example-skeleton {
      width: 315px;
      padding: 16px;
    }

    .example-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      margin-bottom: 24px;
    }

    .example-headline {
      width: 60%;
      height: 24px;
      margin-bottom: 16px;
      border-radius: 4px;
    }

    .example-line {
      width: 100%;
      height: 24px;
      border-radius: 4px;
    }
  `,
})
export class CdkSkeletonDefaultExampleComponent {}
