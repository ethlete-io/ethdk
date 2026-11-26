import { Component, ViewEncapsulation } from '@angular/core';
import { GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON, TAB_IMPORTS, provideIcons } from '@ethlete/components';

@Component({
  selector: 'app-tabs-default-example',
  template: `
    <et-tab-group color="brand">
      <et-tab icon="et-grid-2x2" label="First">
        <p class="example-tab-content">Content of the first tab</p>
      </et-tab>
      <et-tab icon="et-pencil" label="Second">
        <p class="example-tab-content">Content of the second tab</p>
      </et-tab>
      <et-tab icon="et-plus" label="Third">
        <p class="example-tab-content">Content of the third tab</p>
      </et-tab>
    </et-tab-group>

    <et-tab-group>
      <et-tab>
        <ng-template etTabLabel>Home</ng-template>
        <p class="example-tab-content">Home content</p>
      </et-tab>
      <et-tab>
        <ng-template etTabLabel>Settings</ng-template>
        <p class="example-tab-content">Settings content</p>
      </et-tab>
    </et-tab-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TAB_IMPORTS],
  providers: [provideIcons(GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON)],
  styles: `
    .example-tab-content {
      padding: 16px;
    }
  `,
})
export class TabsDefaultExampleComponent {}
