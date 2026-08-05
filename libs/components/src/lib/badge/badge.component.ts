import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

export const BADGE_VARIANTS = {
  FILLED: 'filled',
  TONAL: 'tonal',
  OUTLINE: 'outline',
} as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[keyof typeof BADGE_VARIANTS];

/**
 * A small, non-interactive pill for a status word or a count - "Active", "Beta", "3 new". Unlike
 * `et-chip`, it never removes itself and carries no selection state; reach for a chip when the value
 * is removable or selectable.
 *
 * @example
 * <et-badge color="success">Active</et-badge>
 * <et-badge variant="outline">Beta</et-badge>
 */
@Component({
  selector: 'et-badge',
  template: `<ng-content />`,
  styleUrl: './badge.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-badge',
    '[attr.data-variant]': 'variant()',
  },
})
export class BadgeComponent {
  public variant = input<BadgeVariant>(BADGE_VARIANTS.TONAL);
}
