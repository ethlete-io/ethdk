import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { BUTTON_SIZES, BUTTON_SPINNER_CONFIG, BUTTON_VARIANTS, ButtonSize } from './button.component';
import { ButtonDirective } from './headless';

type IconButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

const PRESSED_VARIANT_MAP: Record<IconButtonVariant, string> = {
  [BUTTON_VARIANTS.FILLED]: 'transparent',
  [BUTTON_VARIANTS.OUTLINE]: 'filled',
  [BUTTON_VARIANTS.TONAL]: 'filled',
  [BUTTON_VARIANTS.TRANSPARENT]: 'tonal',
};

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
    ColorInteractiveDirective,
    FocusRingDirective,
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-icon-button',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-pressed-variant]': 'pressedVariant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class IconButtonComponent {
  protected buttonDir = inject(ButtonDirective);

  public variant = input<IconButtonVariant>(BUTTON_VARIANTS.TRANSPARENT);
  public size = input<ButtonSize>(BUTTON_SIZES.MD);

  public canAnimate = createCanAnimateSignal();

  public spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  public pressedVariant = computed(() => (this.buttonDir.pressed() ? PRESSED_VARIANT_MAP[this.variant()] : null));
}
