import { Component, ViewEncapsulation } from '@angular/core';
import { TabImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-inline-tabs-custom-label-example',
  template: `
    <et-inline-tabs>
      <et-inline-tab>
        <ng-template et-inline-tab-label><strong>First</strong></ng-template>
        Content 1
      </et-inline-tab>
      <et-inline-tab>
        <ng-template et-inline-tab-label><strong>Second</strong></ng-template>
        Content 2
      </et-inline-tab>
      <et-inline-tab>
        <ng-template et-inline-tab-label><strong>Third</strong></ng-template>
        Content 3
      </et-inline-tab>
    </et-inline-tabs>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TabImports],
})
export class CdkInlineTabsCustomLabelExampleComponent {}
