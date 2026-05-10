import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ColoredDirective, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { BUTTON_SIZES, BUTTON_SPINNER_CONFIG, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

@Component({
  selector: '[et-icon-button]',
  template: `
    <div class="et-icon-button-icon">
      <ng-content select="[etIcon]" />
    </div>

    @if (buttonDir.loading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          class="et-button-loader-spinner"
        />
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
    ColoredDirective,
    FocusRingDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color', 'etProvideAltColor:altColor'],
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

  spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);
}
