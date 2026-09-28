// codes 3700-3799
export const BREADCRUMB_ERROR_CODES = {
  /** A breadcrumb part (`etBreadcrumbItemTemplate`, `etBreadcrumbSeparator`) was used outside an `[etBreadcrumb]`. */
  PART_OUTSIDE_BREADCRUMB: 3700,
  /** An `[etBreadcrumb]` rendered no `etBreadcrumbItemTemplate`, so there is no trail to show. */
  MISSING_ITEMS: 3701,
  /** `etBreadcrumbSeo` can reach neither an `etBreadcrumb` on its element nor a breadcrumb manager. */
  SEO_OUTSIDE_BREADCRUMB: 3702,
  /** Something other than an `etBreadcrumbSeparator` was projected into `et-breadcrumb-outlet`, which renders nothing else. */
  OUTLET_UNSUPPORTED_CONTENT: 3703,
  /** A second `et-breadcrumb-outlet` rendered under one breadcrumb manager, so every crumb shows twice in both trails. */
  MULTIPLE_OUTLETS: 3704,
} as const;
