import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import { SpinnerComponent } from '../loader';
import { ButtonStylesDirective } from './button-styles.directive';
import {
  BUTTON_ICON_ALIGNMENTS,
  BUTTON_SIZES,
  BUTTON_SPINNER_CONFIG,
  BUTTON_VARIANTS,
  ButtonIconAlignment,
  ButtonSize,
  ButtonVariant,
} from './button.types';
import { ButtonColorDirective, ButtonDirective } from './headless';

const PRESSED_VARIANT_MAP: Record<ButtonVariant, ButtonVariant> = {
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

    @if (buttonDir.isLoading()) {
      <div class="et-button-loader" aria-hidden="true">
        <et-spinner
          [diameter]="spinnerConfig().diameter"
          [strokeWidth]="spinnerConfig().strokeWidth"
          [track]="buttonDir.hasProgress()"
          [value]="buttonDir.currentProgress()"
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
      inputs: ['disabled', 'loading', 'progress', 'type', 'pressed', 'emitAriaPressed'],
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
    '[attr.data-stretch-contents]': 'stretchContents() || null',
    '[attr.data-pressed-variant]': 'activePressedVariant()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class ButtonComponent {
  protected buttonDir = inject(ButtonDirective);

  public variant = input<ButtonVariant>(BUTTON_VARIANTS.FILLED);
  public size = input<ButtonSize>(BUTTON_SIZES.MD);
  public iconAlignment = input<ButtonIconAlignment>(BUTTON_ICON_ALIGNMENTS.START);

  /** Lets the projected contents fill the space beside the icon, e.g. to push a trailing element to the far edge. */
  public stretchContents = input(false, { transform: booleanAttribute });

  /** The variant the button shows while `pressed`. Defaults to the flavor's fixed swap (e.g. `outline` -> `filled`). */
  public pressedVariant = input<ButtonVariant | undefined>(undefined);

  public canAnimate = createCanAnimateSignal();

  public spinnerConfig = computed(() => BUTTON_SPINNER_CONFIG[this.size()]);

  protected activePressedVariant = computed(() =>
    this.buttonDir.pressed() ? (this.pressedVariant() ?? PRESSED_VARIANT_MAP[this.variant()]) : null,
  );
}
