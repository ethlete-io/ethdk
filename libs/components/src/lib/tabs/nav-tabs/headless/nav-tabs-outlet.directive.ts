import { Directive, afterNextRender, computed, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TAB_ERROR_CODES } from '../../tab-errors';
import { injectNavTabsRegistry } from './nav-tabs-registry';

let nextOutletId = 0;

@Directive({
  selector: '[etNavTabsOutlet]',
  host: {
    role: 'tabpanel',
    '[attr.id]': 'ID',
    '[attr.aria-labelledby]': 'activeTriggerId()',
  },
})
export class NavTabsOutletDirective {
  private nearestTabBar = inject(TabBarDirective, { optional: true });
  private registry = injectNavTabsRegistry();
  private readonly hostElement = injectHostElement();

  public readonly ID = `et-nav-tabs-outlet-${nextOutletId++}`;

  private tabBar = computed(() => this.nearestTabBar ?? this.registry.single());

  public activeTriggerId = computed(() => this.tabBar()?.activeTrigger()?.ID ?? null);

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.nearestTabBar && !this.registry.hasAny()) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_NAV_TABS,
            '[NavTabsOutletDirective] et-nav-tabs-outlet requires an et-nav-tabs element on the page.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
