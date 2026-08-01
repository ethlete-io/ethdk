import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
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
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class RadioComponent {
  public optionDirective = inject(SelectionOptionDirective);

  /**
   * `'card'` turns the option into a full-width clickable panel with the label leading and the control trailing -
   * for a small set of consequential choices (a plan, a shipping speed) where each deserves room for a
   * description. `'plain'` is the ordinary control-then-label row. @default 'plain'
   */
  public variant = input<RadioVariant>(RADIO_VARIANTS.PLAIN);

  public canAnimate = createCanAnimateSignal();
}
