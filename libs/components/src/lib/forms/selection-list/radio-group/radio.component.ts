import { Component, effect, inject, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal, injectStyleManager } from '@ethlete/core';
import { SelectionCardStylesComponent } from '../../selection-card-styles.component';
import { SELECTION_CARD_CONTROL_POSITIONS, SelectionCardControlPosition } from '../../selection-card.types';
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
    '[attr.data-control-position]': "variant() === 'card' ? controlPosition() : null",
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

  /**
   * Which end of the card the control sits at. `'end'` keeps the label leading and the control trailing;
   * `'start'` puts the control first, ahead of any `[etSelectionCardLeading]` media. Only `variant="card"`
   * reads it. @default 'end'
   */
  public controlPosition = input<SelectionCardControlPosition>(SELECTION_CARD_CONTROL_POSITIONS.END);

  public canAnimate = createCanAnimateSignal();

  constructor() {
    effect(() => {
      if (this.variant() === RADIO_VARIANTS.CARD) {
        this.styleManager.mount(SelectionCardStylesComponent);
      }
    });
  }
}
