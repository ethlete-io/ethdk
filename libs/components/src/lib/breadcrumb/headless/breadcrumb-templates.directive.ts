import { DestroyRef, Directive, afterNextRender, booleanAttribute, inject, input, signal } from '@angular/core';
import { RuntimeError, injectTemplateRef } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BREADCRUMB_SEGMENT_TOKEN, BREADCRUMB_TOKEN } from './breadcrumb.tokens';

/** `'BreadcrumbSeparatorDirective'` → the `etBreadcrumbSeparator` selector it is applied with. */
const selectorOf = (directiveName: string) => `et${directiveName.replace('Directive', '')}`;

const assertInsideBreadcrumb = (hasHost: boolean, directiveName: string) => {
  if (ngDevMode) {
    afterNextRender(() => {
      if (!hasHost) {
        throw new RuntimeError(
          BREADCRUMB_ERROR_CODES.PART_OUTSIDE_BREADCRUMB,
          `[${directiveName}] ${selectorOf(directiveName)} must be placed inside an [etBreadcrumb] element ` +
            '(e.g. <et-breadcrumb>) or an <ng-template etBreadcrumbSegment>.',
        );
      }
    });
  }
};

/**
 * One crumb of the trail. A template rather than an element, because the breadcrumb decides where each
 * crumb ends up — inline, or inside the overflow control once the trail stops fitting, or in the shell's
 * outlet several routes above — and a template can be rendered in any of them.
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
  // Two ways in: declared inside an [etBreadcrumb], which finds its crumbs with a content query, or
  // inside an etBreadcrumbSegment, which collects them for the outlet — a content query can't reach into
  // a template that another view renders.
  private breadcrumb = inject(BREADCRUMB_TOKEN, { optional: true });
  private segment = inject(BREADCRUMB_SEGMENT_TOKEN, { optional: true });

  public templateRef = injectTemplateRef();

  /** Render a placeholder instead of the crumb, for a label that hasn't arrived yet. @default false */
  public loading = input(false, { transform: booleanAttribute });

  /**
   * @internal Whether this is the last crumb — the current page, which is what `aria-current` goes on.
   * Pushed here by whatever renders the trail: the crumb can't work it out itself, since the trail it
   * ends up in may be composed from segments it knows nothing about.
   */
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
 * Replaces the chevron the default breadcrumb draws between crumbs — a slash, a bullet, an icon of your
 * own. Rendered once per gap and hidden from assistive tech either way.
 *
 * It belongs to the breadcrumb rather than to a segment: put it inside the `<et-breadcrumb>` (or the
 * outlet), not in a routed view's segment.
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
