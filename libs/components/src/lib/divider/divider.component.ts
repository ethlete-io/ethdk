import { booleanAttribute, Component, input, ViewEncapsulation } from '@angular/core';

export type DividerOrientation = 'horizontal' | 'vertical';

/**
 * A thin rule between two groups of content or controls, announced as a separator.
 *
 * A `vertical` divider sizes itself from its parent's cross axis, so it needs a flex or grid parent
 * (or an explicit `block-size`) to be visible. Set `decorative` when the grouping is already clear
 * from the surrounding markup - the rule then carries no semantics at all.
 *
 * @example
 * <et-divider />
 *
 * @example
 * <div class="flex items-center">
 *   <button et-button>Save</button>
 *   <et-divider orientation="vertical" decorative />
 *   <button et-button>Discard</button>
 * </div>
 */
@Component({
  selector: 'et-divider',
  template: ``,
  styleUrl: './divider.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-divider',
    '[attr.data-orientation]': 'orientation()',
    '[attr.role]': 'decorative() ? "presentation" : "separator"',
    '[attr.aria-orientation]': 'decorative() ? null : orientation()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
})
export class DividerComponent {
  public orientation = input<DividerOrientation>('horizontal');

  public decorative = input(false, { transform: booleanAttribute });
}
