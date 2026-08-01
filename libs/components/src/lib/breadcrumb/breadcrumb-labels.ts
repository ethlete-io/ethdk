import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the breadcrumb announces. It renders no text of its own — the crumbs are yours — so
 * these are all accessible labels. Defaults are English ({@link DEFAULT_BREADCRUMB_LABELS}); override
 * them app-wide with {@link provideBreadcrumbLabels} or per instance via the `labels` input.
 */
export type BreadcrumbLabels = {
  /** Accessible label for the navigation landmark. */
  navigation: string;
  /** Accessible label for the control that opens the collapsed middle crumbs. */
  overflow: string;
};

/** The built-in English labels. */
export const DEFAULT_BREADCRUMB_LABELS: BreadcrumbLabels = {
  navigation: 'Breadcrumb',
  overflow: 'Show hidden levels',
};

const BREADCRUMB_LABELS_DEF = /* @__PURE__ */ defineLabels<BreadcrumbLabels>(
  'BREADCRUMB_LABELS',
  DEFAULT_BREADCRUMB_LABELS,
);

/**
 * Localize the breadcrumb's strings for everything below this injector, and read the set in effect
 * here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_BREADCRUMB_LABELS}
 * value. See {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideBreadcrumbLabels({ navigation: 'Brotkrumen', overflow: 'Ausgeblendete Ebenen anzeigen' });
 */
export const provideBreadcrumbLabels = /* @__PURE__ */ toProvideFn(BREADCRUMB_LABELS_DEF);
export const injectBreadcrumbLabels = /* @__PURE__ */ toInjectFn(BREADCRUMB_LABELS_DEF);
export const BREADCRUMB_LABELS = /* @__PURE__ */ toToken(BREADCRUMB_LABELS_DEF);
