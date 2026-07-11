import { DestroyRef, Directive, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLinkActive } from '@angular/router';
import { RuntimeError } from '@ethlete/core';
import { tap } from 'rxjs';
import { TabBarTriggerDirective } from '../../headless/tab-bar-trigger.directive';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TAB_ERROR_CODES } from '../../tab-errors';
import { NAV_TABS_TOKEN } from './nav-tabs.tokens';

@Directive({
  selector: '[etNavTabLink]',
})
export class NavTabLinkDirective {
  private routerLinkActive = inject(RouterLinkActive, { self: true });
  private navTabs = inject(NAV_TABS_TOKEN, { optional: true });
  private tabBar = inject(TabBarDirective, { optional: true });
  private destroyRef = inject(DestroyRef);

  public trigger = inject(TabBarTriggerDirective);

  private routerLinkIsActive = signal(this.routerLinkActive.isActive ?? false);

  public isActive = computed(() => this.routerLinkIsActive());

  constructor() {
    this.routerLinkActive.isActiveChange
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((active) => {
          this.routerLinkIsActive.set(active);
        }),
      )
      .subscribe();

    effect(() => {
      if (this.isActive()) {
        this.tabBar?.selectTrigger(this.trigger);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.navTabs) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_NAV_TABS,
            '[NavTabLinkDirective] a[et-nav-tab-link] must be placed inside an et-nav-tabs element.',
          );
        }
      });
    }
  }
}
