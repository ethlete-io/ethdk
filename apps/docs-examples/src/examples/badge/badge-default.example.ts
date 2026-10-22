import { Component, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, CHECK_ICON, ICON_IMPORTS, provideIcons, STAR_ICON } from '@ethlete/components';

@Component({
  selector: 'app-badge-default-example',
  template: `
    <div>
      <et-badge>Default</et-badge>
      <et-badge color="brand">Brand</et-badge>
      <et-badge color="success">Active</et-badge>
      <et-badge color="warning">Pending</et-badge>
      <et-badge color="danger">3 errors</et-badge>
    </div>

    <div>
      <et-badge color="success">
        <i etIcon="et-check"></i>
        Verified
      </et-badge>
      <et-badge color="warning" iconAlignment="end">
        <i etIcon="et-star"></i>
        Featured
      </et-badge>
    </div>

    <div>
      <et-badge size="sm">sm</et-badge>
      <et-badge size="md">md</et-badge>
      <et-badge size="lg">lg</et-badge>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(CHECK_ICON, STAR_ICON)],
})
export class BadgeDefaultExampleComponent {}
