import { Component, ViewEncapsulation, input } from '@angular/core';
import { CHEVRON_ICON, IconDirective, TRIANGLE_EXCLAMATION_ICON, provideIcons } from '../icon';
import { SpinnerComponent } from '../loader';

/** What the slot in front of a tree row shows. */
export const TREE_MARKERS = {
  /** Nothing - a leaf, which keeps the slot so its label lines up with its siblings. */
  NONE: 'none',
  /** A collapsed or expanded branch; the rotation follows the row's `data-expanded`. */
  CHEVRON: 'chevron',
  /** The branch is loading its children. */
  SPINNER: 'spinner',
  /** The branch failed to load. */
  WARNING: 'warning',
} as const;

export type TreeMarker = (typeof TREE_MARKERS)[keyof typeof TREE_MARKERS];

/**
 * The slot in front of a tree row: its chevron, load spinner or failure mark. Its own component so
 * that it - and not the tree - is what registers the icons it draws. A `provideIcons()` on the tree
 * would sit above every projected row template in the injector tree and hide the consumer's own icon
 * registration from it, since an embedded view resolves DI from where it is inserted.
 */
@Component({
  selector: 'et-tree-marker',
  template: `
    @switch (marker()) {
      @case ('spinner') {
        <et-spinner [diameter]="12" />
      }
      @case ('warning') {
        <i class="et-tree-node-warning" etIcon="et-triangle-exclamation"></i>
      }
      @case ('chevron') {
        <i class="et-tree-node-chevron" etIcon="et-chevron"></i>
      }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, SpinnerComponent],
  providers: [provideIcons(CHEVRON_ICON, TRIANGLE_EXCLAMATION_ICON)],
  host: {
    class: 'et-tree-node-marker',
    'aria-hidden': 'true',
  },
})
export class TreeMarkerComponent {
  public marker = input<TreeMarker>(TREE_MARKERS.NONE);
}
