import { Component, ViewEncapsulation } from '@angular/core';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  TRIANGLE_EXCLAMATION_ICON,
  ICON_IMPORTS,
  provideIcons,
} from '@ethlete/components';

@Component({
  selector: 'app-banner-warning-example',
  template: `
    <et-banner
      type="warning"
      heading="Storage almost full"
      description="You are running low on storage space - consider upgrading your plan."
      dismissible
    >
      <i etIcon="et-triangle-exclamation"></i>
      <button et-text-button etBannerAction type="button">Retry</button>
    </et-banner>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, ICON_IMPORTS, BUTTON_IMPORTS],
  providers: [provideIcons(TRIANGLE_EXCLAMATION_ICON)],
})
export class BannerWarningExampleComponent {}
