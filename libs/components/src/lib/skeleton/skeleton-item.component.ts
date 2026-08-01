import { Component, input, ViewEncapsulation } from '@angular/core';

/** The common placeholder shapes. Anything else is your own CSS on the item. */
export type SkeletonShape = 'text' | 'rect' | 'circle';

/**
 * One placeholder shape inside an `<et-skeleton>`. Sized by `shape` for the usual cases and by
 * `--et-skeleton-size` / plain CSS for everything else. Hidden from assistive tech - the container's
 * text is the announcement.
 *
 * @example
 * <et-skeleton-item shape="text" />
 * <et-skeleton-item shape="circle" style="--et-skeleton-size: 40px" />
 * <et-skeleton-item style="block-size: 120px; border-radius: 12px" />
 */
@Component({
  selector: 'et-skeleton-item',
  template: '',
  styleUrl: './skeleton.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton-item',
    'aria-hidden': 'true',
    '[attr.data-shape]': 'shape()',
  },
})
export class SkeletonItemComponent {
  /**
   * `'text'` (default) is a line of text's height, so it sits in running copy without changing the
   * layout; `'rect'` is a block you size yourself; `'circle'` is square-and-round for an avatar.
   */
  public shape = input<SkeletonShape>('text');
}
