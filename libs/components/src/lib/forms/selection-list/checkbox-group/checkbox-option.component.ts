import { Component, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, injectStyleManager } from '@ethlete/core';
import { SelectionCardStylesComponent } from '../../selection-card-styles.component';
import { SelectionOptionDirective } from '../headless';

/** How a checkbox option presents itself. See {@link CheckboxOptionComponent.variant}. */
export const CHECKBOX_OPTION_VARIANTS = {
  PLAIN: 'plain',
  CARD: 'card',
} as const;

export type CheckboxOptionVariant = (typeof CHECKBOX_OPTION_VARIANTS)[keyof typeof CHECKBOX_OPTION_VARIANTS];

@Component({
  selector: 'et-checkbox-option',
  templateUrl: './checkbox-option.component.html',
  styleUrl: './checkbox-option.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: SelectionOptionDirective,
      inputs: ['value', 'checked', 'disabled'],
      outputs: ['checkedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-checkbox-option',
    '[attr.data-variant]': 'variant()',
    '[class.et-selection-card]': "variant() === 'card'",
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class CheckboxOptionComponent {
  public optionDirective = inject(SelectionOptionDirective);

  private styleManager = injectStyleManager();

  /**
   * `'card'` turns the option into a full-width clickable panel with the label leading and the control trailing -
   * for a small set of consequential choices where each deserves room for a description. `'plain'` is the ordinary
   * control-then-label row. @default 'plain'
   */
  public variant = input<CheckboxOptionVariant>(CHECKBOX_OPTION_VARIANTS.PLAIN);

  public canAnimate = createCanAnimateSignal();

  constructor() {
    effect(() => {
      if (this.variant() === CHECKBOX_OPTION_VARIANTS.CARD) {
        this.styleManager.mount(SelectionCardStylesComponent);
      }
    });
  }
}
