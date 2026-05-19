import { Directive, computed, inject } from '@angular/core';
import { TabBarDirective } from '../../headless/tab-bar.directive';

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
  private tabBar = inject(TabBarDirective);

  public readonly ID = `et-nav-tabs-outlet-${nextOutletId++}`;

  public activeTriggerId = computed(() => this.tabBar.activeTrigger()?.ID ?? null);
}
