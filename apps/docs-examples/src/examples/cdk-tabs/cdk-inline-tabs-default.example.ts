import { Component, ViewEncapsulation } from '@angular/core';
import { TabImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-inline-tabs-default-example',
  template: `
    <et-inline-tabs>
      <et-inline-tab label="Tab One">Content 1</et-inline-tab>
      <et-inline-tab label="Other Tab">Content 2</et-inline-tab>
      <et-inline-tab label="One more Tab">Content 3</et-inline-tab>
      <et-inline-tab label="Disabled Tab" disabled>Content 4</et-inline-tab>
    </et-inline-tabs>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TabImports],
})
export class CdkInlineTabsDefaultExampleComponent {}
