import { Directive, computed, inject, input } from '@angular/core';
import { ScrollableNavigationComponent } from './scrollable-navigation.component';
import { ScrollableDirective } from './scrollable.directive';

/** Options for `etScrollableNavigation`. */
export type ScrollableNavigationConfig = {
  /** Turn the dots off without removing the directive. @default true */
  enabled?: boolean;
};

/**
 * Adds the carousel-style dots below an `<et-scrollable>`, one per child, tracking whichever is in view.
 * Opt-in, and it turns the child intersection observer on - a track that only scrolls does not need
 * either. Ships in `SCROLLABLE_NAVIGATION_IMPORTS`.
 *
 * Decorative like the buttons (`aria-hidden`, not tabbable).
 */
@Directive({
  selector: 'et-scrollable[etScrollableNavigation], [etScrollable][etScrollableNavigation]',
})
export class ScrollableNavigationDirective {
  private scrollable = inject(ScrollableDirective);

  public config = input<ScrollableNavigationConfig | ''>('', { alias: 'etScrollableNavigation' });

  public enabled = computed(() => {
    const config = this.config();

    return config === '' ? true : (config.enabled ?? true);
  });

  constructor() {
    this.scrollable.registerChrome({
      key: 'navigation',
      slot: 'footer',
      component: ScrollableNavigationComponent,
      enabled: this.enabled,
      order: 1,
    });
  }
}
