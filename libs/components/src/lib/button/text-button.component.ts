import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideThemeDirective } from '@ethlete/core';
import { BUTTON_SIZES, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

@Component({
  selector: '[et-text-button]',
  template: '<ng-content />',
  styleUrl: './text-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'type'],
    },
    {
      directive: ProvideThemeDirective,
      inputs: ['etProvideTheme:theme', 'etProvideAltTheme:altTheme'],
    },
  ],
  host: {
    class: 'et-text-button',
    '[attr.data-size]': 'size()',
  },
})
export class TextButtonComponent {
  size = input<ButtonSize>(BUTTON_SIZES.MD);
}
