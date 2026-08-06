import { Component, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, injectStyleManager } from '@ethlete/core';
import { SelectionCardStylesComponent } from '../../selection-card-styles.component';
import { SelectionOptionDirective } from '../headless';

/** How a radio presents itself. See {@link RadioComponent.variant}. */
export const RADIO_VARIANTS = {
  PLAIN: 'plain',
  CARD: 'card',
} as const;

export type RadioVariant = (typeof RADIO_VARIANTS)[keyof typeof RADIO_VARIANTS];

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrl: './radio.component.css',
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
    class: 'et-radio',
    '[attr.data-variant]': 'variant()',
    '[class.et-selection-card]': "variant() === 'card'",
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class RadioComponent {
  public optionDirective = inject(SelectionOptionDirective);

  private styleManager = injectStyleManager();

  /**
   * `'card'` turns the option into a full-width clickable panel with the label leading and the control trailing -
   * for a small set of consequential choices (a plan, a shipping speed) where each deserves room for a
   * description. `'plain'` is the ordinary control-then-label row. @default 'plain'
   */
  public variant = input<RadioVariant>(RADIO_VARIANTS.PLAIN);

  public canAnimate = createCanAnimateSignal();

  constructor() {
    effect(() => {
      if (this.variant() === RADIO_VARIANTS.CARD) {
        this.styleManager.mount(SelectionCardStylesComponent);
      }
    });
  }
}
