import { Breakpoint, ColorThemeInput, defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { ButtonSize, ButtonVariant } from '../../button/button.types';
import { ScrollableButtonPosition } from './scrollable.types';

/** A value, or one per breakpoint. A breakpoint key applies from that breakpoint up until the next key. */
export type ScrollableResponsive<T> = T | Partial<Record<Breakpoint, T>>;

/** App-wide defaults for the previous/next buttons of every `<et-scrollable>`. */
export type ScrollableButtonsDefaults = {
  /**
   * Whether the buttons render. `true` adds them to every scrollable that imports
   * `SCROLLABLE_NAVIGATION_IMPORTS`, without `etScrollableButtons` on it. @default false
   */
  enabled?: ScrollableResponsive<boolean>;
  /**
   * `'inside'` floats the buttons over the track's edges, `'inline'` puts them beside the track at the
   * row's ends, `'footer'` puts them in a row below it. @default 'inside'
   */
  position?: ScrollableResponsive<ScrollableButtonPosition>;
  /** Keep the buttons in view while the page scrolls past a tall track. Only with `'inside'`. @default false */
  sticky?: boolean;
  /** Size of the two icon buttons. @default 'xs' */
  size?: ButtonSize;
  /**
   * Colour theme of the buttons, resolved by the colour-theme tokens. The `color` input on the
   * `<et-scrollable>` wins. @default the surrounding colour scope
   */
  color?: ColorThemeInput;
  /** Button variant. `'filled'` gives the buttons a `color` fill. @default 'transparent' */
  variant?: ButtonVariant;
};

export type ScrollableConfig = {
  buttons?: ScrollableButtonsDefaults;
};

const SCROLLABLE_CONFIG_DEF = /* @__PURE__ */ defineStaticRootProvider<ScrollableConfig>(
  {},
  { name: 'ScrollableConfig' },
);

/**
 * Sets app-wide scrollable defaults. Inputs on an instance (`etScrollableButtons`) win over them.
 *
 * @example
 * providers: [provideScrollableConfig({ buttons: { enabled: { md: true }, position: { xs: 'inline', lg: 'inside' } } })]
 */
export const provideScrollableConfig = /* @__PURE__ */ toProvideFn(SCROLLABLE_CONFIG_DEF);
export const injectScrollableConfig = /* @__PURE__ */ toInjectFn(SCROLLABLE_CONFIG_DEF);
