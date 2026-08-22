// codes 3700-3799
export const BREADCRUMB_ERROR_CODES = {
  /** A breadcrumb part (`etBreadcrumbItemTemplate`, `etBreadcrumbSeparator`) was used outside an `[etBreadcrumb]`. */
  PART_OUTSIDE_BREADCRUMB: 3700,
  /** An `[etBreadcrumb]` rendered no `etBreadcrumbItemTemplate`, so there is no trail to show. */
  MISSING_ITEMS: 3701,
  /** `etBreadcrumbSeo` can reach neither an `etBreadcrumb` on its element nor a breadcrumb manager. */
  SEO_OUTSIDE_BREADCRUMB: 3702,
} as const;
