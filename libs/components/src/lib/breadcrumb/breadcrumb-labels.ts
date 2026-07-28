import { InjectionToken, Provider, inject } from '@angular/core';

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

/** The label set every breadcrumb in this injector uses. @default DEFAULT_BREADCRUMB_LABELS */
export const BREADCRUMB_LABELS = new InjectionToken<BreadcrumbLabels>('BREADCRUMB_LABELS', {
  providedIn: 'root',
  factory: () => DEFAULT_BREADCRUMB_LABELS,
});

/**
 * Localize the breadcrumb's strings for everything below this injector. Partial — whatever you leave
 * out keeps its {@link DEFAULT_BREADCRUMB_LABELS} value.
 *
 * @example
 * provideBreadcrumbLabels({ navigation: 'Brotkrumen', overflow: 'Ausgeblendete Ebenen anzeigen' });
 */
export const provideBreadcrumbLabels = (labels: Partial<BreadcrumbLabels>): Provider => ({
  provide: BREADCRUMB_LABELS,
  useValue: { ...DEFAULT_BREADCRUMB_LABELS, ...labels },
});

export const injectBreadcrumbLabels = () => inject(BREADCRUMB_LABELS);
