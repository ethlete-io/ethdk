import { InjectionToken, StaticProvider, inject } from '@angular/core';
import { OffsetOptions } from '@floating-ui/dom';

export const MENU_CONFIG_TOKEN = new InjectionToken<MenuConfig>('MENU_CONFIG_TOKEN');

export type MenuConfig = {
  /** Replaces the default offset of root menus (4px). A trigger's `[offset]` input still wins. */
  offset?: OffsetOptions;
};

/**
 * Sets app-wide menu defaults.
 *
 * @example
 * providers: [provideMenuConfig({ offset: 2 })]
 */
export const provideMenuConfig = (config: MenuConfig): StaticProvider[] => {
  return [{ provide: MENU_CONFIG_TOKEN, useValue: config }];
};

export const injectMenuConfig = (): MenuConfig | null => inject(MENU_CONFIG_TOKEN, { optional: true });
