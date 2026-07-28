import { booleanAttribute, Component, input, ViewEncapsulation } from '@angular/core';

/**
 * A loading placeholder: a box (or several) standing in for content that hasn't arrived, with an
 * optional shimmer sweeping across.
 *
 * Light by default — the container announces the wait to assistive tech and owns the animation switch;
 * the shapes are `<et-skeleton-item>`s sized by your own CSS, or by their `shape` for the common cases.
 * Colors come from the surface tokens, so a skeleton reads correctly on any surface it is placed on.
 *
 * @example
 * <et-skeleton>
 *   <et-skeleton-item shape="circle" style="--et-skeleton-size: 40px" />
 *   <et-skeleton-text lines="3" />
 * </et-skeleton>
 */
@Component({
  selector: 'et-skeleton',
  template: `<span class="et-skeleton-ally-text">{{ loadingAllyText() }}</span
    ><ng-content />`,
  styleUrl: './skeleton.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
    role: 'status',
    'aria-busy': 'true',
    '[class.et-skeleton--animated]': 'animated()',
  },
})
export class SkeletonComponent {
  /**
   * What a screen reader announces in place of the shapes, which are `aria-hidden` — they carry no
   * information, and reading "loading" once is the whole message.
   */
  public loadingAllyText = input('Loading…');

  /**
   * Run the shimmer. Off leaves a static placeholder — the same shapes without motion, which is what
   * you want inside something that already animates (an opening panel), or on a very long list.
   * Independent of `prefers-reduced-motion`, which drops the shimmer regardless. @default true
   */
  public animated = input(true, { transform: booleanAttribute });
}
