import { DestroyRef, Directive, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLinkActive } from '@angular/router';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { tap } from 'rxjs';
import { OVERLAY_ROUTER_LINK_TOKEN } from '../../../overlay/routing/overlay-router-link.directive';
import { TabBarTriggerDirective } from '../../headless/tab-bar-trigger.directive';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TAB_ERROR_CODES } from '../../tab-errors';
import { NAV_TABS_TOKEN } from './nav-tabs.tokens';

@Directive({
  selector: '[etNavTabLink]',
})
export class NavTabLinkDirective {
  private routerLinkActive = inject(RouterLinkActive, { self: true, optional: true });
  private overlayRouterLink = inject(OVERLAY_ROUTER_LINK_TOKEN, { self: true, optional: true });
  private navTabs = inject(NAV_TABS_TOKEN, { optional: true });
  private tabBar = inject(TabBarDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private readonly hostElement = injectHostElement();

  public trigger = inject(TabBarTriggerDirective);

  private routerLinkIsActive = signal(this.routerLinkActive?.isActive ?? false);

  public isActive = computed(() => this.overlayRouterLink?.isActive() ?? this.routerLinkIsActive());

  constructor() {
    // The router owns the selection: a click only asks to navigate, so a guard that vetoes or stalls
    // the navigation leaves the tab bar where it is.
    this.trigger.deferSelection.set(true);

    this.routerLinkActive?.isActiveChange
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((active) => {
          this.routerLinkIsActive.set(active);
        }),
      )
      .subscribe();

    effect(() => {
      if (this.isActive() && this.tabBar?.activeTrigger() !== this.trigger) {
        this.tabBar?.selectTrigger(this.trigger);
      }
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.navTabs) {
          throw new RuntimeError(
            TAB_ERROR_CODES.MISSING_NAV_TABS,
            '[NavTabLinkDirective] a nav tab link must be placed inside an et-nav-tabs element.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
