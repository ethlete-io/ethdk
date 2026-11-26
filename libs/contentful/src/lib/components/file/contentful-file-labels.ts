import { formatFileSize } from '@ethlete/components';
import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** Every string `et-contentful-file` renders itself. Override them app-wide with {@link provideContentfulFileLabels}. */
export type ContentfulFileLabels = {
  /** The size shown after the file title, e.g. `'(1.5 MB)'`. */
  fileSize: (bytes: number) => string;
};

/** The built-in English labels. */
export const DEFAULT_CONTENTFUL_FILE_LABELS: ContentfulFileLabels = {
  fileSize: (bytes) => `(${formatFileSize(bytes)})`,
};

const CONTENTFUL_FILE_LABELS_DEF = /* @__PURE__ */ defineLabels<ContentfulFileLabels>(
  'CONTENTFUL_FILE_LABELS',
  DEFAULT_CONTENTFUL_FILE_LABELS,
);

/**
 * Localize `et-contentful-file` for everything below this injector, and read the set in effect here as a signal.
 * Partial - whatever you leave out keeps its {@link DEFAULT_CONTENTFUL_FILE_LABELS} value.
 *
 * @example
 * provideContentfulFileLabels({ fileSize: (bytes) => `(${new Intl.NumberFormat('de').format(bytes)} Byte)` });
 */
export const provideContentfulFileLabels = /* @__PURE__ */ toProvideFn(CONTENTFUL_FILE_LABELS_DEF);
export const injectContentfulFileLabels = /* @__PURE__ */ toInjectFn(CONTENTFUL_FILE_LABELS_DEF);
export const CONTENTFUL_FILE_LABELS = /* @__PURE__ */ toToken(CONTENTFUL_FILE_LABELS_DEF);
