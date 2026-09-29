import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings an avatar group renders itself. */
export type AvatarLabels = {
  /** Accessible name of the `+N` overflow avatar, e.g. `'3 more'`. */
  more: (count: number) => string;
};

/** The built-in English labels. */
export const DEFAULT_AVATAR_LABELS: AvatarLabels = {
  more: (count) => `${count} more`,
};

const AVATAR_LABELS_DEF = /* @__PURE__ */ defineLabels<AvatarLabels>('AVATAR_LABELS', DEFAULT_AVATAR_LABELS);

/**
 * Localize an avatar group's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_AVATAR_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideAvatarLabels({ more: (count) => `${count} weitere` });
 */
export const provideAvatarLabels = /* @__PURE__ */ toProvideFn(AVATAR_LABELS_DEF);
export const injectAvatarLabels = /* @__PURE__ */ toInjectFn(AVATAR_LABELS_DEF);
export const AVATAR_LABELS = /* @__PURE__ */ toToken(AVATAR_LABELS_DEF);
