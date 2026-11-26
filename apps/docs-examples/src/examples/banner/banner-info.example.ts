import { Component, ViewEncapsulation } from '@angular/core';
import { BANNER_IMPORTS, BUTTON_IMPORTS, CIRCLE_INFO_ICON, ICON_IMPORTS, provideIcons } from '@ethlete/components';

@Component({
  selector: 'app-banner-info-example',
  template: `
    <et-banner
      type="info"
      heading="Heads up"
      description="This is an informational message for the current page or section."
      dismissible
    >
      <i etIcon="et-circle-info"></i>
      <button et-text-button etBannerAction type="button">Retry</button>
    </et-banner>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, ICON_IMPORTS, BUTTON_IMPORTS],
  providers: [provideIcons(CIRCLE_INFO_ICON)],
})
export class BannerInfoExampleComponent {}
