import { Directive, ElementRef, computed, effect, inject, untracked } from '@angular/core';
import { createFlipAnimation } from '@ethlete/core';
import { TAB_BAR_TOKEN, TAB_BAR_TRIGGER_TOKEN } from './tab-bar.tokens';

@Directive({
  selector: '[etTabBarUnderline]',
  host: {
    class: 'et-tab-bar-underline',
    '[class.et-tab-bar-underline--active]': 'isActive()',
  },
})
export class TabBarUnderlineDirective {
  private tabBar = inject(TAB_BAR_TOKEN);
  private trigger = inject(TAB_BAR_TRIGGER_TOKEN);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public isActive = computed(() => this.tabBar.activeTrigger() === this.trigger);

  constructor() {
    effect(() => {
      const activeTrigger = this.tabBar.activeTrigger();

      if (activeTrigger !== this.trigger) {
        return;
      }

      const underlineEl = this.elementRef.nativeElement;
      const previousOriginEl = untracked(() => this.tabBar.lastActiveUnderlineElement());

      // Store this underline element for the next transition
      untracked(() => {
        this.tabBar.lastActiveUnderlineElement.set(underlineEl);
      });

      // Skip animation until the tab bar has completed initial render
      if (!previousOriginEl || !this.tabBar.animationsReady() || previousOriginEl === underlineEl) {
        return;
      }

      const flip = createFlipAnimation({
        element: underlineEl,
        originElement: previousOriginEl,
        duration: 250,
        easing: 'cubic-bezier(0.35, 0.25, 0.2, 1)',
      });

      flip.play();
    });
  }
}
