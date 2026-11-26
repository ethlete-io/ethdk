import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { RegisteredIconName } from '../../icon';

export type SelectIcons = {
  /** The trigger's open/close chevron, also drawn (rotated) on the panel's load-more row. */
  chevron: RegisteredIconName;
  /** The trigger's clear button. */
  clear: RegisteredIconName;
  /** The mark on a selected option. */
  check: RegisteredIconName;
};

export const DEFAULT_SELECT_ICONS: SelectIcons = {
  chevron: 'et-chevron',
  clear: 'et-times',
  check: 'et-check',
};

const SELECT_ICONS_DEF = /* @__PURE__ */ defineStaticRootProvider(DEFAULT_SELECT_ICONS, { name: 'SelectIcons' });

/**
 * Swap the glyphs the select draws itself, for every select below this injector. Each value is an icon name; register
 * a name outside the built-in `et-*` set with `provideIconOverrides()`. Partial - whatever you leave out keeps its
 * {@link DEFAULT_SELECT_ICONS} value.
 *
 * @example
 * provideSelectIcons({ chevron: 'app-caret', check: 'app-tick' });
 */
export const provideSelectIcons = /* @__PURE__ */ toProvideFn(SELECT_ICONS_DEF);
export const injectSelectIcons = /* @__PURE__ */ toInjectFn(SELECT_ICONS_DEF);
