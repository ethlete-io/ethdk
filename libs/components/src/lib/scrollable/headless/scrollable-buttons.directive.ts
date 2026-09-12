import { Directive, computed, inject, input } from '@angular/core';
import { ScrollableButtonsComponent } from './scrollable-buttons.component';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableButtonPosition } from './scrollable.types';

/** Options for `etScrollableButtons`. */
export type ScrollableButtonsConfig = {
  /**
   * `'inside'` floats the two buttons over the track's edges; `'footer'` puts them in a row below it,
   * next to the dots when `etScrollableNavigation` is on too. @default 'inside'
   */
  position?: ScrollableButtonPosition;
  /**
   * Keep the buttons in view while the page scrolls past a tall track, rather than letting them travel
   * off with it. Only meaningful with `position: 'inside'`. @default false
   */
  sticky?: boolean;
  /** Turn the buttons off without removing the directive. @default true */
  enabled?: boolean;
};

/**
 * Adds the previous/next scroll buttons to an `<et-scrollable>`. Opt-in, applied on the `<et-scrollable>`
 * itself. Ships in `SCROLLABLE_NAVIGATION_IMPORTS`.
 *
 * The buttons are decorative - `aria-hidden`, not tabbable - because a scroll container is already
 * keyboard-operable. Controls that must be reachable belong to the consumer.
 */
@Directive({
  selector: 'et-scrollable[etScrollableButtons], [etScrollable][etScrollableButtons]',
  host: {
    '[class.et-scrollable--sticky-buttons]': 'sticky() && position() === "inside"',
  },
})
export class ScrollableButtonsDirective {
  private scrollable = inject(ScrollableDirective);

  public config = input<ScrollableButtonsConfig | ''>('', { alias: 'etScrollableButtons' });

  private resolved = computed(() => {
    const config = this.config();

    return config === '' ? {} : config;
  });

  public position = computed(() => this.resolved().position ?? 'inside');
  public sticky = computed(() => this.resolved().sticky ?? false);
  public enabled = computed(() => this.resolved().enabled ?? true);

  constructor() {
    this.scrollable.registerChrome({
      key: 'buttons',
      slot: computed(() => (this.position() === 'footer' ? 'footer' : 'overlay')),
      component: ScrollableButtonsComponent,
      inputs: computed(() => ({ position: this.position() })),
      enabled: this.enabled,
      order: 0,
    });
  }
}
