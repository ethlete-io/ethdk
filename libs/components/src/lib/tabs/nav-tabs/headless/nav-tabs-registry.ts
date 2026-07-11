import { Signal, computed, signal } from '@angular/core';
import { createRootProvider } from '@ethlete/core';
import { TabBarDirective } from '../../headless/tab-bar.directive';

/** @internal */
export type NavTabsRegistry = {
  /** The only registered tab bar, or null when none or more than one exists. */
  single: Signal<TabBarDirective | null>;
  hasAny: Signal<boolean>;
  register: (tabBar: TabBarDirective) => void;
  unregister: (tabBar: TabBarDirective) => void;
};

/**
 * Tracks the tab bars of all nav-tabs elements on the page so a nav-tabs outlet
 * placed as a sibling of its et-nav-tabs element can still resolve the tab bar
 * that labels it.
 *
 * @internal
 */
export const [provideNavTabsRegistry, injectNavTabsRegistry] = createRootProvider(
  (): NavTabsRegistry => {
    const tabBars = signal<TabBarDirective[]>([]);

    const single = computed(() => {
      const bars = tabBars();

      return bars.length === 1 ? (bars[0] ?? null) : null;
    });

    const hasAny = computed(() => tabBars().length > 0);

    const register = (tabBar: TabBarDirective) => {
      tabBars.update((list) => [...list, tabBar]);
    };

    const unregister = (tabBar: TabBarDirective) => {
      tabBars.update((list) => list.filter((bar) => bar !== tabBar));
    };

    return { single, hasAny, register, unregister };
  },
  { name: 'NavTabsRegistry' },
);
