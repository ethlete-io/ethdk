import { computed, Directive, inject, input } from '@angular/core';
// The route is the base a relative command list resolves against - the same job `routerLink` gives it -
// not a source of values to read, which is what the rule below is about.
// eslint-disable-next-line ethlete/no-angular-router-api
import { ActivatedRoute, Router } from '@angular/router';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableRowCommandsLink } from './table.types';

/** Options for {@link TableRowRouterLinkDirective}. */
export type TableRowRouterLinkConfig = TableFeatureConfig;

/**
 * Whether the browser, not the router, should handle a click: a middle or right button, or any modifier
 * the user presses to open a link somewhere else. Exactly what `RouterLink` leaves alone, and the reason
 * the table renders a real `href` at all.
 */
const opensElsewhere = (event: MouseEvent) =>
  event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

/**
 * Opt-in Angular routing for an `et-table`'s [row links](/components/table#row-links): with it, a
 * `[rowLink]` may answer with router commands (`['/orders', order.id]`) instead of an `href` string, and
 * a plain click navigates through the router rather than loading the page again.
 *
 * The commands are resolved relative to the route the table sits on, the way `routerLink` resolves its
 * own. Modified clicks - middle button, Ctrl/Cmd/Shift - are left to the browser, which is what keeps
 * "open in a new tab" working on the same rows.
 *
 * It is a feature rather than part of the table because the base table depends on no router: a table that
 * links with plain `href` strings - or not at all - never pulls `@angular/router` into its bundle.
 *
 * @example
 * <et-table [data]="orders()" [columns]="COLUMNS" [rowLink]="orderLink" etTableRowRouterLink />
 *
 * protected orderLink = (order: Order) => ['/orders', order.id];
 */
@Directive({
  selector: '[etTableRowRouterLink]',
  exportAs: 'etTableRowRouterLink',
})
export class TableRowRouterLinkDirective {
  private table = injectTableFeatureHost('etTableRowRouterLink');
  private router = inject(Router);
  // eslint-disable-next-line ethlete/no-angular-router-api
  private route = inject(ActivatedRoute, { optional: true });

  /** See {@link TableRowRouterLinkConfig}. */
  public config = input({} as TableRowRouterLinkConfig, {
    alias: 'etTableRowRouterLink',
    transform: tableFeatureConfig<TableRowRouterLinkConfig>,
  });

  constructor() {
    this.table.registerRowNavigation({
      href: (link) => this.href(link),
      navigate: (link, event) => this.navigate(link, event),
      enabled: computed(() => this.config().enabled ?? true),
    });
  }

  /** The URL this link resolves to - what the row's anchor carries as its `href`. */
  public href(link: readonly unknown[] | TableRowCommandsLink) {
    return this.router.serializeUrl(this.urlTree(link));
  }

  /** Navigate to this link, unless the click asked for the browser's own behaviour. */
  public navigate(link: readonly unknown[] | TableRowCommandsLink, event: MouseEvent) {
    if (opensElsewhere(event)) return false;

    this.router.navigateByUrl(this.urlTree(link));

    return true;
  }

  private urlTree(link: readonly unknown[] | TableRowCommandsLink) {
    const { commands, queryParams, fragment } = Array.isArray(link)
      ? ({ commands: link } as TableRowCommandsLink)
      : (link as TableRowCommandsLink);

    return this.router.createUrlTree([...commands], { relativeTo: this.route, queryParams, fragment });
  }
}
