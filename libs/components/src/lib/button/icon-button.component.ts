import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject, input } from '@angular/core';
import { ColorThemedDirective, ProvideThemeDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../spinner/spinner.component';
import { ButtonStylesDirective } from './button-styles.directive';
import { BUTTON_SIZES, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

@Component({
  selector: '[et-icon-button]',
  template: `
    <div class="et-icon-button-icon">
      <ng-content select="[etIcon]" />
    </div>

    @if (buttonDir.loading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner class="et-button-loader-spinner" diameter="16" strokeWidth="2" />
      </div>
    }
  `,
  styleUrl: './icon-button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'type', 'pressed'],
    },
    ButtonStylesDirective,
    ColorThemedDirective,
    FocusRingDirective,
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
  protected buttonDir = inject(ButtonDirective);

  size = input<ButtonSize>(BUTTON_SIZES.MD);
}
