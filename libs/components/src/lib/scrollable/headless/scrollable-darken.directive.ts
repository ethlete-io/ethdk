import { Directive, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { signalClasses } from '@ethlete/core';
import { ScrollableDirective } from './scrollable.directive';

/**
 * Fades the children that are only partly in view, so a track reads as continuing past its edge.
 *
 * Opt-in, applied on the `<et-scrollable>` itself - it turns the child intersection observer on, which a
 * plain track does not otherwise need. Ships in `SCROLLABLE_DARKEN_IMPORTS`.
 */
@Directive({
  selector: '[etScrollableDarken]',
  host: {
    '[class.et-scrollable--darken-non-intersecting-items]': 'enabled()',
  },
})
export class ScrollableDarkenDirective {
  private scrollable = inject(ScrollableDirective);

  public enabled = input(true, { transform: booleanAttribute, alias: 'etScrollableDarken' });

  private nonFullIntersecting = computed(
    () => {
      if (!this.enabled()) return [];

      const allIntersections = this.scrollable.childIntersections();
      return allIntersections.filter((i) => i.intersectionRatio !== 1).map((i) => i.target as HTMLElement);
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );

  /** @internal */
  public nonFullIntersectingClassBindings = signalClasses(this.nonFullIntersecting, {
    'et-scrollable-item--not-intersecting': signal(true),
  });

  constructor() {
    this.scrollable.activateChildIntersections();
  }
}
