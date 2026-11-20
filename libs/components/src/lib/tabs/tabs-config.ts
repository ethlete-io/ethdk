import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

export const TAB_UNDERLINE_WIDTHS = {
  TAB: 'tab',
  LABEL: 'label',
} as const;

export type TabUnderlineWidth = (typeof TAB_UNDERLINE_WIDTHS)[keyof typeof TAB_UNDERLINE_WIDTHS];

export type TabsConfig = {
  /** Default for `activeUnderline` on every tab group and nav tabs bar. An explicit input still wins. */
  activeUnderline?: boolean;
  /** Default for `underlineWidth` on every tab group and nav tabs bar. An explicit input still wins. */
  underlineWidth?: TabUnderlineWidth;
};

const TABS_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<TabsConfig>({}, { name: 'TabsConfig' });

/**
 * Sets app-wide tab bar defaults.
 *
 * @example
 * providers: [provideTabsConfig({ activeUnderline: false, underlineWidth: 'label' })]
 */
export const provideTabsConfig = /* @__PURE__ */ toProvideFn(TABS_CONFIG_DEF);
export const injectTabsConfig = /* @__PURE__ */ toInjectFn(TABS_CONFIG_DEF);
