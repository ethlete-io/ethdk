import { Directive, computed } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { injectRouterEvent } from '@ethlete/core';
import { NAV_TABS_TOKEN } from './nav-tabs.tokens';

@Directive({
  selector: '[etNavTabs]',
  providers: [{ provide: NAV_TABS_TOKEN, useExisting: NavTabsDirective }],
})
export class NavTabsDirective {
  private routerEvent = injectRouterEvent();

  /** @internal */
  navigationVersion = computed(() => {
    const event = this.routerEvent();

    if (event instanceof NavigationEnd) {
      return event.id;
    }

    return -1;
  });
}
