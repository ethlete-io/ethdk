import { Component, input, ViewEncapsulation } from '@angular/core';
import {
  CIRCLE_CHECK_ICON,
  CIRCLE_INFO_ICON,
  ICON_IMPORTS,
  provideIcons,
  RegisteredIconName,
  TRIANGLE_EXCLAMATION_ICON,
} from '../../icon';
import { BUTTON_IMPORTS } from '../../button';
import { BANNER_IMPORTS } from '../banner.imports';
import { BannerType } from '../banner.component';

@Component({
  selector: 'et-sb-banner',
  template: `
    <div class="flex flex-wrap items-start gap-8 p-8 font-sans">
      <et-banner [heading]="heading()" [description]="description()" [type]="type()" [dismissible]="dismissible()">
        <i [etIcon]="icon()"></i>

        @if (showAction()) {
          <button et-text-button etBannerAction type="button">Retry</button>
        }
      </et-banner>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...BANNER_IMPORTS, ...ICON_IMPORTS, ...BUTTON_IMPORTS],
  providers: [provideIcons(CIRCLE_INFO_ICON, CIRCLE_CHECK_ICON, TRIANGLE_EXCLAMATION_ICON)],
})
export class BannerStorybookComponent {
  public heading = input('Heads up');
  public description = input('This is an informational message for the current page or section.');
  public type = input<BannerType>('info');
  public icon = input<RegisteredIconName>('et-circle-info');
  public dismissible = input(true);
  public showAction = input(true);
}
