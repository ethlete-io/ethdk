import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { ButtonDirective } from './headless';

export const BUTTON_SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

export type ButtonSize = (typeof BUTTON_SIZES)[keyof typeof BUTTON_SIZES];

export const BUTTON_ICON_ALIGNMENTS = {
  START: 'start',
  END: 'end',
} as const;

export type ButtonIconAlignment = (typeof BUTTON_ICON_ALIGNMENTS)[keyof typeof BUTTON_ICON_ALIGNMENTS];

export const BUTTON_VARIANTS = {
  FILLED: 'filled',
  OUTLINE: 'outline',
  TONAL: 'tonal',
  TRANSPARENT: 'transparent',
} as const;

type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

export const BUTTON_SPINNER_CONFIG: Record<ButtonSize, { diameter: number; strokeWidth: number }> = {
  [BUTTON_SIZES.XS]: { diameter: 12, strokeWidth: 1.5 },
  [BUTTON_SIZES.SM]: { diameter: 14, strokeWidth: 1.75 },
  [BUTTON_SIZES.MD]: { diameter: 16, strokeWidth: 2 },
  [BUTTON_SIZES.LG]: { diameter: 20, strokeWidth: 2.5 },
  [BUTTON_SIZES.XL]: { diameter: 24, strokeWidth: 3 },
};

const PRESSED_VARIANT_MAP: Record<ButtonVariant, string> = {
  [BUTTON_VARIANTS.FILLED]: 'outline',
  [BUTTON_VARIANTS.OUTLINE]: 'filled',
  [BUTTON_VARIANTS.TONAL]: 'filled',
  [BUTTON_VARIANTS.TRANSPARENT]: 'tonal',
};

@Component({
  selector: '[et-button]',
  template: `
    @if (iconAlignment() === 'start') {
      <div class="et-button-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    <div class="et-button-contents">
      <ng-content />
    </div>

    @if (iconAlignment() === 'end') {
      <div class="et-button-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    @if (buttonDir.loading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          class="et-button-loader-spinner"
        />
      </div>
    }

    <ng-template #iconTpl>
      <ng-content select="[etIcon]" />
    </ng-template>
  `,
  styleUrl: './button.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SpinnerComponent],
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
      inputs: ['etProvideColor:color', 'etProvideAltColor:altColor'],
    },
  ],
  host: {
    class: 'et-button',
    '[attr.data-icon-alignment]': 'iconAlignment()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-pressed-variant]': 'pressedVariant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class ButtonComponent {
  protected buttonDir = inject(ButtonDirective);

  variant = input<ButtonVariant>(BUTTON_VARIANTS.FILLED);
  size = input<ButtonSize>(BUTTON_SIZES.MD);
  iconAlignment = input<ButtonIconAlignment>(BUTTON_ICON_ALIGNMENTS.START);

  canAnimate = createCanAnimateSignal();

  spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  pressedVariant = computed(() => (this.buttonDir.pressed() ? PRESSED_VARIANT_MAP[this.variant()] : null));
}
