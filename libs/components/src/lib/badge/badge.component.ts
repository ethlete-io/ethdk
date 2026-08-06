import { NgTemplateOutlet } from '@angular/common';
import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

export const BADGE_VARIANTS = {
  FILLED: 'filled',
  TONAL: 'tonal',
  OUTLINE: 'outline',
} as const;

export type BadgeVariant = (typeof BADGE_VARIANTS)[keyof typeof BADGE_VARIANTS];

export const BADGE_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

export type BadgeSize = (typeof BADGE_SIZES)[keyof typeof BADGE_SIZES];

export const BADGE_ICON_ALIGNMENTS = {
  START: 'start',
  END: 'end',
} as const;

export type BadgeIconAlignment = (typeof BADGE_ICON_ALIGNMENTS)[keyof typeof BADGE_ICON_ALIGNMENTS];

/**
 * A small, non-interactive pill for a status word or a count - "Active", "Beta", "3 new". Unlike
 * `et-chip`, it never removes itself and carries no selection state; reach for a chip when the value
 * is removable or selectable.
 *
 * An element carrying `etIcon` is projected into the badge's icon slot and sized to the badge's own
 * font size; everything else becomes the label.
 *
 * @example
 * <et-badge color="success">Active</et-badge>
 * <et-badge variant="outline">Beta</et-badge>
 * <et-badge size="lg"><i etIcon="et-check"></i>Verified</et-badge>
 */
@Component({
  selector: 'et-badge',
  template: `
    @if (iconAlignment() === 'start') {
      <div class="et-badge-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    <ng-content />

    @if (iconAlignment() === 'end') {
      <div class="et-badge-icon">
        <ng-container *ngTemplateOutlet="iconTpl" />
      </div>
    }

    <ng-template #iconTpl>
      <ng-content select="[etIcon]" />
    </ng-template>
  `,
  styleUrl: './badge.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-badge',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[attr.data-icon-alignment]': 'iconAlignment()',
  },
})
export class BadgeComponent {
  public variant = input<BadgeVariant>(BADGE_VARIANTS.TONAL);
  public size = input<BadgeSize>(BADGE_SIZES.MD);
  public iconAlignment = input<BadgeIconAlignment>(BADGE_ICON_ALIGNMENTS.START);
}
