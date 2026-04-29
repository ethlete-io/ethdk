import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { ProvideThemeDirective } from '@ethlete/core';
import { BUTTON_SIZES, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

@Component({
  selector: '[et-icon-button]',
  template: '<ng-content />',
  styleUrl: './icon-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'type', 'pressed'],
    },
    {
      directive: ProvideThemeDirective,
      inputs: ['etProvideTheme:theme', 'etProvideAltTheme:altTheme'],
    },
  ],
  host: {
    class: 'et-icon-button',
    '[attr.data-size]': 'size()',
  },
})
export class IconButtonComponent {
  size = input<ButtonSize>(BUTTON_SIZES.MD);
}
