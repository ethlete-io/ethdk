import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import { ButtonColorDirective, ButtonDirective } from './headless';

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

export type ButtonVariant = (typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS];

export const BUTTON_SPINNER_CONFIG: Record<ButtonSize, { diameter: number; strokeWidth: number }> = {
  xs: { diameter: 12, strokeWidth: 1.5 },
  sm: { diameter: 14, strokeWidth: 1.75 },
  md: { diameter: 16, strokeWidth: 2 },
  lg: { diameter: 20, strokeWidth: 2.5 },
  xl: { diameter: 24, strokeWidth: 3 },
};

const PRESSED_VARIANT_MAP: Record<ButtonVariant, string> = {
  filled: 'outline',
  outline: 'filled',
  tonal: 'filled',
  transparent: 'tonal',
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
          [determinate]="buttonDir.hasProgress()"
          [track]="buttonDir.hasProgress()"
          [value]="buttonDir.progress() ?? 0"
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
  imports: [NgTemplateOutlet, SpinnerComponent],
  hostDirectives: [
    {
      directive: ButtonDirective,
      inputs: ['disabled', 'loading', 'progress', 'type', 'pressed'],
    },
    ButtonStylesDirective,
    ColorInteractiveDirective,
    FocusRingDirective,
    {
      directive: ButtonColorDirective,
      inputs: ['color', 'pressedColor'],
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

  public variant = input<ButtonVariant>(BUTTON_VARIANTS.FILLED);
  public size = input<ButtonSize>(BUTTON_SIZES.MD);
  public iconAlignment = input<ButtonIconAlignment>(BUTTON_ICON_ALIGNMENTS.START);

  public canAnimate = createCanAnimateSignal();

  public spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  public pressedVariant = computed(() => (this.buttonDir.pressed() ? PRESSED_VARIANT_MAP[this.variant()] : null));
}
