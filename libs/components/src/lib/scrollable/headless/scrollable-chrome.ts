import { Injector, Signal, Type } from '@angular/core';

/**
 * Where the scrollable stamps a registered piece of chrome: `'overlay'` is the layer sitting on top of the
 * track (edge masks, the inline scroll buttons), `'footer'` the row below it, which only exists while
 * something is registered for it and the track can actually scroll.
 */
export type ScrollableChromeSlot = 'overlay' | 'footer';

/**
 * A component an opt-in feature contributes to the scrollable's own DOM.
 *
 * The scrollable never imports a feature's component - the feature is a directive on `<et-scrollable>` and
 * hands the component over from its constructor. That is what keeps the scroll buttons (and with them the
 * icon button and the spinner) out of a bundle that only imports {@link SCROLLABLE_IMPORTS}.
 */
export type ScrollableChrome = {
  /** Stable name of the contribution - the scrollable classes its footer after what it holds. */
  key: string;
  /** Which slot to stamp into. A signal for a feature whose slot follows an input (the buttons' position). */
  slot: ScrollableChromeSlot | Signal<ScrollableChromeSlot>;
  /** The component to stamp. */
  component: Type<unknown>;
  /** Inputs to bind on it, re-evaluated when the signal changes. */
  inputs?: Signal<Record<string, unknown>>;
  /**
   * The injector the stamped component resolves from - pass the feature's own (`inject(Injector)`) so the
   * component can inject the feature that registered it. Defaults to the scrollable's own view injector,
   * which already reaches the `ScrollableDirective`.
   */
  injector?: Injector;
  /** Render order within the slot - lower renders first. @default 0 */
  order?: number;
  /**
   * Whether the contribution is live. A feature registers once, in its constructor, and gates itself with
   * this rather than re-registering, so it can be toggled at runtime.
   */
  enabled?: Signal<boolean>;
};

/** A {@link ScrollableChrome} with its reactive fields read - what the scrollable's template renders. @internal */
export type ResolvedScrollableChrome = {
  key: string;
  slot: ScrollableChromeSlot;
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  injector?: Injector;
};
