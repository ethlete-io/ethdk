import { DestroyRef, Directive, computed, inject } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { injectRouterEvent } from '@ethlete/core';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { injectNavTabsRegistry } from './nav-tabs-registry';
import { NAV_TABS_TOKEN } from './nav-tabs.tokens';

@Directive({
  selector: '[etNavTabs]',
  providers: [{ provide: NAV_TABS_TOKEN, useExisting: NavTabsDirective }],
})
export class NavTabsDirective {
  private routerEvent = injectRouterEvent();
  private registry = injectNavTabsRegistry();
  private tabBar = inject(TabBarDirective, { self: true });
  private destroyRef = inject(DestroyRef);

  /** @internal */
  public navigationVersion = computed(() => {
    const event = this.routerEvent();

    if (event instanceof NavigationEnd) {
      return event.id;
    }

    return -1;
  });

  constructor() {
    this.registry.register(this.tabBar);

    this.destroyRef.onDestroy(() => {
      this.registry.unregister(this.tabBar);
    });
  }
}
