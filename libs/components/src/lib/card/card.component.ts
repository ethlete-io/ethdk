import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';

export const CARD_VARIANTS = {
  ELEVATED: 'elevated',
  OUTLINED: 'outlined',
  FILLED: 'filled',
} as const;

export type CardVariant = (typeof CARD_VARIANTS)[keyof typeof CARD_VARIANTS];

/**
 * A generic content container - the padded, bordered or shadowed box every dashboard reaches for.
 * Content is yours; the card only owns the surrounding chrome.
 *
 * @example
 * <et-card variant="elevated">
 *   <h3>Revenue</h3>
 *   <p>$12,400 this month</p>
 * </et-card>
 */
@Component({
  selector: 'et-card',
  template: `<ng-content />`,
  styleUrl: './card.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ProvideSurfaceDirective,
      inputs: ['etProvideSurface:surface'],
    },
  ],
  host: {
    class: 'et-card',
    '[attr.data-variant]': 'variant()',
  },
})
export class CardComponent {
  public variant = input<CardVariant>(CARD_VARIANTS.OUTLINED);
}
