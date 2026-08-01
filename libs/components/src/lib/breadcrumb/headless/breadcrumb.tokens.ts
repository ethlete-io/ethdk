import { InjectionToken, Type } from '@angular/core';
import { BreadcrumbDirective } from './breadcrumb.directive';
import { BreadcrumbSegmentDirective } from './breadcrumb-segment.directive';

export const BREADCRUMB_TOKEN = new InjectionToken<BreadcrumbDirective>('BREADCRUMB_TOKEN');

/**
 * What a breadcrumb needs from the collapse affordance: the component that renders the crumbs which
 * didn't fit. The breadcrumb only ever sees this type, which is what keeps the toggletip - and with it
 * the overlay runtime - out of a bundle that never imports `BREADCRUMB_COLLAPSE_IMPORTS`.
 */
export type BreadcrumbCollapseAffordance = {
  /** Rendered in the overflow slot with `items` (the hidden crumbs) and `crumbTemplate` as inputs. */
  overflowComponent: Type<unknown>;
};

export const BREADCRUMB_COLLAPSE_TOKEN = new InjectionToken<BreadcrumbCollapseAffordance>('BREADCRUMB_COLLAPSE_TOKEN');

export const BREADCRUMB_SEGMENT_TOKEN = new InjectionToken<BreadcrumbSegmentDirective>('BREADCRUMB_SEGMENT_TOKEN');
