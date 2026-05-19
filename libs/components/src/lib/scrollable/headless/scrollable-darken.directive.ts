import { Directive, computed, inject, signal } from '@angular/core';
import { signalClasses } from '@ethlete/core';
import { ScrollableDirective } from './scrollable.directive';

@Directive({
  selector: '[etScrollableDarken]',
})
export class ScrollableDarkenDirective {
  private scrollable = inject(ScrollableDirective);

  private nonFullIntersecting = computed(
    () => {
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
    this.scrollable.darkenDirective.set(this);
  }
}
