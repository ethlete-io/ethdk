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

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_AVATAR_LABELS: AvatarLabels = {
  more: (count) => `${count} weitere`,
};

/** The label set for a locale. Anything other than English and German needs {@link provideAvatarLabels}. */
export const avatarLabelsForLocale = (locale: string): AvatarLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_AVATAR_LABELS : DEFAULT_AVATAR_LABELS;

const AVATAR_LABELS_DEF = /* @__PURE__ */ defineLabels<AvatarLabels>('AVATAR_LABELS', avatarLabelsForLocale);

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
