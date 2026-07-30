import { createLabels } from '@ethlete/core';

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

/**
 * Localize the breadcrumb's strings for everything below this injector, and read the set in effect
 * here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_BREADCRUMB_LABELS}
 * value. See {@link createLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideBreadcrumbLabels({ navigation: 'Brotkrumen', overflow: 'Ausgeblendete Ebenen anzeigen' });
 */
export const [provideBreadcrumbLabels, injectBreadcrumbLabels, BREADCRUMB_LABELS] = createLabels<BreadcrumbLabels>(
  'BREADCRUMB_LABELS',
  DEFAULT_BREADCRUMB_LABELS,
);
