import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings a copy button announces itself. */
export type CopyButtonLabels = {
  /** Announced to screen readers once the value has reached the clipboard. */
  copied: string;
  /** Announced to screen readers when the value could not be copied (insecure context, denied permission). */
  copyFailed: string;
};

/** The built-in English labels. */
export const DEFAULT_COPY_BUTTON_LABELS: CopyButtonLabels = {
  copied: 'Copied',
  copyFailed: 'Copy failed',
};

const COPY_BUTTON_LABELS_DEF = /* @__PURE__ */ defineLabels<CopyButtonLabels>(
  'COPY_BUTTON_LABELS',
  DEFAULT_COPY_BUTTON_LABELS,
);

/**
 * Localize a copy button's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_COPY_BUTTON_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideCopyButtonLabels({ copied: 'Kopiert', copyFailed: 'Kopieren fehlgeschlagen' });
 */
export const provideCopyButtonLabels = /* @__PURE__ */ toProvideFn(COPY_BUTTON_LABELS_DEF);
export const injectCopyButtonLabels = /* @__PURE__ */ toInjectFn(COPY_BUTTON_LABELS_DEF);
export const COPY_BUTTON_LABELS = /* @__PURE__ */ toToken(COPY_BUTTON_LABELS_DEF);
