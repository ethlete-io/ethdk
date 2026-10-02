import { booleanAttribute, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { mountVisuallyHidden } from '@ethlete/core';
import { injectLoaderLabels, LoaderLabels } from '../loader';

/**
 * A loading placeholder: a box (or several) standing in for content that hasn't arrived, with an
 * optional shimmer sweeping across.
 *
 * Light by default - the container announces the wait to assistive tech and owns the animation switch;
 * the shapes are `<et-skeleton-item>`s sized by your own CSS, or by their `shape` for the common cases.
 * Colors come from the surface tokens, so a skeleton reads correctly on any surface it is placed on.
 *
 * @example
 * <et-skeleton>
 *   <et-skeleton-item shape="circle" [style.--et-skeleton-size.px]="40" />
 *   <et-skeleton-text lines="3" />
 * </et-skeleton>
 */
@Component({
  selector: 'et-skeleton',
  template: `<span class="et-visually-hidden et-skeleton-ally-text">{{ resolvedLabels().loadingContent }}</span
    ><ng-content />`,
  styleUrl: './skeleton.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
    role: 'status',
    '[class.et-skeleton--animated]': 'animated()',
  },
})
export class SkeletonComponent {
  private injectedLabels = injectLoaderLabels();

  /**
   * Per-instance overrides merged over the injected `LOADER_LABELS`. `loadingContent` is what a screen reader
   * announces in place of the shapes - set it for something more specific (`{ loadingContent: 'Loading results' }`).
   */
  public labels = input<Partial<LoaderLabels> | null>(null);

  /**
   * Run the shimmer. Off leaves a static placeholder - the same shapes without motion, which is what
   * you want inside something that already animates (an opening panel), or on a very long list.
   * Independent of `prefers-reduced-motion`, which drops the shimmer regardless. @default true
   */
  public animated = input(true, { transform: booleanAttribute });

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<LoaderLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  constructor() {
    mountVisuallyHidden();
  }
}
