import { Directive, afterNextRender, booleanAttribute, computed, inject, input } from '@angular/core';
import { RuntimeError, injectTemplateRef } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BREADCRUMB_TOKEN } from './breadcrumb.tokens';

/** `'BreadcrumbSeparatorDirective'` → the `etBreadcrumbSeparator` selector it is applied with. */
const selectorOf = (directiveName: string) => `et${directiveName.replace('Directive', '')}`;

const assertInsideBreadcrumb = (breadcrumb: unknown, directiveName: string) => {
  if (ngDevMode) {
    afterNextRender(() => {
      if (!breadcrumb) {
        throw new RuntimeError(
          BREADCRUMB_ERROR_CODES.PART_OUTSIDE_BREADCRUMB,
          `[${directiveName}] ${selectorOf(directiveName)} must be placed inside an [etBreadcrumb] element ` +
            '(e.g. <et-breadcrumb>).',
        );
      }
    });
  }
};

/**
 * One crumb of the trail. A template rather than an element, because the breadcrumb decides where each
 * crumb ends up — inline, or inside the overflow control once the trail stops fitting — and a template
 * can be rendered in either place.
 *
 * Put whatever the crumb is inside it: a `routerLink` anchor, plain text for the current page, a
 * `<button>`. Marking it `loading` renders a placeholder instead, for a name that is still being
 * fetched — the crumb keeps its slot in the trail meanwhile.
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

  public templateRef = injectTemplateRef();

  /** Render a placeholder instead of the crumb, for a label that hasn't arrived yet. @default false */
  public loading = input(false, { transform: booleanAttribute });

  /** Whether this is the last crumb — the current page, which is what `aria-current` goes on. */
  public isLast = computed(() => {
    const items = this.breadcrumb?.items() ?? [];

    return items.length > 0 && items[items.length - 1] === this;
  });

  constructor() {
    assertInsideBreadcrumb(this.breadcrumb, 'BreadcrumbItemTemplateDirective');
  }
}

/**
 * Replaces the chevron the default breadcrumb draws between crumbs — a slash, a bullet, an icon of your
 * own. Rendered once per gap and hidden from assistive tech either way.
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
    assertInsideBreadcrumb(this.breadcrumb, 'BreadcrumbSeparatorDirective');
  }
}
