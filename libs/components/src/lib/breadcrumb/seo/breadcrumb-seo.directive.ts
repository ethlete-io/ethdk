import { booleanAttribute, computed, Directive, inject, input } from '@angular/core';
import { applyStructuredDataBinding, JsonLD, RuntimeError } from '@ethlete/core';
import { injectBreadcrumbManager } from '../breadcrumb-manager';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BREADCRUMB_TOKEN } from '../headless/breadcrumb.tokens';

/**
 * Opt-in `schema.org` **BreadcrumbList** markup for a breadcrumb. Put it on the same element as
 * `etBreadcrumb` (or on `<et-breadcrumb>` / `<et-breadcrumb-outlet>`) and it emits a JSON-LD
 * `<script>` describing the trail, which is what gets a site the breadcrumb line in a search result
 * instead of a bare URL.
 *
 * It reads the `name` and `url` each crumb states - not the rendered DOM. A crumb's content is a
 * template that may hold an icon or markup with no single text form, and its `routerLink` is a path
 * where `schema.org` wants an absolute URL; both are things only the app can say:
 *
 * ```html
 * <ng-template etBreadcrumbItemTemplate name="Teams" url="https://example.com/teams">
 *   <a etBreadcrumbItem routerLink="/teams">Teams</a>
 * </ng-template>
 * ```
 *
 * Crumbs still **loading** are skipped, and so are crumbs with no `name` - a `BreadcrumbList` with a
 * placeholder in it is worse than a shorter one. Nothing is emitted at all until at least two named
 * crumbs exist, since a one-item trail tells a crawler nothing it doesn't already know.
 *
 * Separate from the breadcrumb itself so an app that does no head management never pulls the
 * structured-data store into its bundle - the same split as `etPaginationSeo`.
 *
 * @example
 * <et-breadcrumb etBreadcrumbSeo>…</et-breadcrumb>
 */
@Directive({
  selector: '[etBreadcrumbSeo]',
  exportAs: 'etBreadcrumbSeo',
})
export class BreadcrumbSeoDirective {
  private breadcrumb = inject(BREADCRUMB_TOKEN, { optional: true });
  private breadcrumbManager = injectBreadcrumbManager({ optional: true });

  /**
   * Turn the markup off without removing the directive - a directive can't be applied conditionally,
   * so this is how `[etBreadcrumbSeo]="isPublicPage()"` gates it. Writing it bare turns it on.
   * @default true
   */
  public enabled = input(true, { transform: booleanAttribute, alias: 'etBreadcrumbSeo' });

  /**
   * The trail as a `BreadcrumbList`, or `null` when there isn't enough of one to describe. Built from
   * `items()` rather than `renderedItems()`: collapsing is a layout decision, and a crawler should see
   * the whole trail whether or not it currently fits on screen.
   */
  public structuredData = computed<JsonLD.WithContext<JsonLD.BreadcrumbList> | null>(() => {
    if (!this.enabled()) return null;

    const named = (this.breadcrumb?.items() ?? this.breadcrumbManager?.crumbs() ?? [])
      .filter((crumb) => !crumb.loading() && !!crumb.name?.())
      .map((crumb) => ({ name: crumb.name?.() ?? '', url: crumb.url?.() ?? null }));

    if (named.length < 2) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: named.map((crumb, index) => ({
        '@type': 'ListItem',
        // schema.org positions are 1-based.
        position: index + 1,
        name: crumb.name,
        // `item` is omitted rather than empty for the current page - that is what Google's own
        // breadcrumb guidance asks for on the last crumb.
        ...(crumb.url ? { item: crumb.url } : {}),
      })),
    };
  });

  constructor() {
    if (ngDevMode && !this.breadcrumb && !this.breadcrumbManager) {
      throw new RuntimeError(
        BREADCRUMB_ERROR_CODES.SEO_OUTSIDE_BREADCRUMB,
        '[BreadcrumbSeoDirective] etBreadcrumbSeo must sit on an element with etBreadcrumb, or on <et-breadcrumb-outlet> with provideBreadcrumbManager() in scope.',
      );
    }

    applyStructuredDataBinding(this.structuredData);
  }
}
