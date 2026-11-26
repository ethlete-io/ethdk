import { defineStaticRootProvider, toInjectFn, toProvideFn } from '@ethlete/core';

/** What stands in for a participant's emblem when it has none or the image fails: the initial in a circle, or a crest outline. */
export type MatchEmblemFallback = 'initial' | 'shield';

export type MatchDefaults = {
  emblemFallback: MatchEmblemFallback;
};

export const DEFAULT_MATCH_DEFAULTS: MatchDefaults = {
  emblemFallback: 'initial',
};

const MATCH_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider(DEFAULT_MATCH_DEFAULTS, {
  name: 'MatchDefaults',
});

/**
 * Set the default `emblemFallback` of every match participant and match card below this injector. Partial -
 * whatever you leave out keeps its {@link DEFAULT_MATCH_DEFAULTS} value. An input set on a component still wins.
 *
 * @example
 * provideMatchDefaults({ emblemFallback: 'shield' });
 */
export const provideMatchDefaults = /* @__PURE__ */ toProvideFn(MATCH_DEFAULTS_DEF);
export const injectMatchDefaults = /* @__PURE__ */ toInjectFn(MATCH_DEFAULTS_DEF);
