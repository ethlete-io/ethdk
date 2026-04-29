import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { ProvideThemeDirective } from '@ethlete/core';
import { ButtonDirective } from './headless';

export const BUTTON_SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

export type ButtonSize = (typeof BUTTON_SIZES)[keyof typeof BUTTON_SIZES];

export const BUTTON_VARIANTS = {
  FILLED: 'filled',
  OUTLINE: 'outline',
  TONAL: 'tonal',
  TRANSPARENT: 'transparent',
} as const;

type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

const PRESSED_VARIANT_MAP: Record<ButtonVariant, string> = {
  [BUTTON_VARIANTS.FILLED]: 'outline',
  [BUTTON_VARIANTS.OUTLINE]: 'filled',
  [BUTTON_VARIANTS.TONAL]: 'filled',
  [BUTTON_VARIANTS.TRANSPARENT]: 'tonal',
};

@Component({
  selector: '[et-button]',
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
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
    class: 'et-button',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-pressed-variant]': 'pressedVariant()',
  },
})
export class ButtonComponent {
  private buttonDir = inject(ButtonDirective);

  variant = input<ButtonVariant>(BUTTON_VARIANTS.FILLED);
  size = input<ButtonSize>(BUTTON_SIZES.MD);

  pressedVariant = computed(() => (this.buttonDir.pressed() ? PRESSED_VARIANT_MAP[this.variant()] : null));
}
