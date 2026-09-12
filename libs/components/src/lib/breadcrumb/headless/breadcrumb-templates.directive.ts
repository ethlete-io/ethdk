import { DestroyRef, Directive, afterNextRender, booleanAttribute, inject, input, signal } from '@angular/core';
import { RuntimeError, injectHostElement, injectTemplateRef } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BREADCRUMB_SEGMENT_TOKEN, BREADCRUMB_TOKEN } from './breadcrumb.tokens';

const selectorOf = (directiveName: string) => `et${directiveName.replace('Directive', '')}`;

const assertInsideBreadcrumb = (hasHost: boolean, directiveName: string) => {
  if (ngDevMode) {
    const element = injectHostElement<Comment>();

    afterNextRender(() => {
      if (!hasHost) {
        throw new RuntimeError(
          BREADCRUMB_ERROR_CODES.PART_OUTSIDE_BREADCRUMB,
          `[${directiveName}] ${selectorOf(directiveName)} must be placed inside an [etBreadcrumb] element ` +
            '(e.g. <et-breadcrumb>) or an <ng-template etBreadcrumbSegment>.',
          { element },
        );
      }
    });
  }
};

/**
 * One crumb of the trail.
 *
 * Put whatever the crumb is inside it: a `routerLink` anchor, plain text for the current page, a
 * `<button>`. Marking it `loading` renders a placeholder instead, for a name that is still being
 * fetched - the crumb keeps its slot in the trail meanwhile.
 *
 * @example
 * <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem routerLink="/teams">Teams</a></ng-template>
 * <ng-template etBreadcrumbItemTemplate [loading]="team.isLoading()">
 *   <span etBreadcrumbItem>{{ team.name() }}</span>
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etBreadcrumbItemTemplate]',
  exportAs: 'etBreadcrumbItemTemplate',
})
export class BreadcrumbItemTemplateDirective {
  private breadcrumb = inject(BREADCRUMB_TOKEN, { optional: true });
  private segment = inject(BREADCRUMB_SEGMENT_TOKEN, { optional: true });

  public templateRef = injectTemplateRef();

  /** Render a placeholder instead of the crumb, for a label that hasn't arrived yet. @default false */
  public loading = input(false, { transform: booleanAttribute });

  /**
   * This crumb's plain-text name for **structured data** - read only by
   * [`etBreadcrumbSeo`](/components/breadcrumb#seo-structured-data), never rendered.
   */
  public name = input<string | null>(null);

  /**
   * This crumb's **absolute** URL for structured data, same story as {@link name}. Omit it on the last
   * crumb: the page it names is the page the markup is on.
   */
  public url = input<string | null>(null);

  /** @internal Whether this is the last crumb - the current page, which is what `aria-current` goes on. */
  public isLast = signal(false);

  constructor() {
    const segment = this.segment;

    if (segment) {
      segment.registerCrumb(this);

      inject(DestroyRef).onDestroy(() => segment.unregisterCrumb(this));
    }

    assertInsideBreadcrumb(!!this.breadcrumb || !!segment, 'BreadcrumbItemTemplateDirective');
  }
}

/**
 * Replaces the chevron the default breadcrumb draws between crumbs - a slash, a bullet, an icon of your
 * own. Rendered once per gap and hidden from assistive tech either way.
 *
 * Put it inside the `<et-breadcrumb>` (or the outlet), not in a routed view's segment.
 *
 * @example
 * <ng-template etBreadcrumbSeparator>/</ng-template>
 */
@Directive({
  selector: 'ng-template[etBreadcrumbSeparator]',
  exportAs: 'etBreadcrumbSeparator',
})
export class BreadcrumbSeparatorDirective {
  private breadcrumb = inject(BREADCRUMB_TOKEN, { optional: true });

  public templateRef = injectTemplateRef();

  constructor() {
    assertInsideBreadcrumb(!!this.breadcrumb, 'BreadcrumbSeparatorDirective');
  }
}
