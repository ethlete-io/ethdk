import { Signal, TemplateRef, WritableSignal } from '@angular/core';

/**
 * What the breadcrumb needs from a crumb — implemented by `etBreadcrumbItemTemplate`. It is a
 * structural type so the manager and the breadcrumb can pass crumbs around without importing the
 * directive that produces them.
 */
export type BreadcrumbCrumb = {
  /** The crumb's content, rendered wherever the trail decides it goes (inline or in the overflow). */
  templateRef: TemplateRef<unknown>;

  /** Whether to render a placeholder instead, because the crumb's label hasn't arrived yet. */
  loading: Signal<boolean>;

  /**
   * Plain-text name for structured data, when the crumb states one — see `etBreadcrumbSeo`. Optional
   * so a hand-rolled crumb object stays as small as it was; a crumb without it is left out of the
   * emitted `BreadcrumbList`.
   */
  name?: Signal<string | null>;

  /** Absolute URL for structured data. Omitted on the last crumb, which is the current page. */
  url?: Signal<string | null>;

  /** @internal Set by whatever renders the trail: the last crumb is the current page (`aria-current`). */
  isLast: WritableSignal<boolean>;
};

/**
 * One view's contribution to the trail, registered with the breadcrumb manager by
 * `etBreadcrumbSegment`. The outlet renders the crumbs of every registered segment as a single trail.
 */
export type BreadcrumbSegment = {
  /** The segment's template — it declares crumb templates and renders nothing itself. */
  templateRef: TemplateRef<unknown>;

  /** The crumbs this segment contributes, in declaration order. */
  crumbs: Signal<readonly BreadcrumbCrumb[]>;

  /** Explicit position in the trail, overriding registration order. `null` (the default) keeps that order. */
  order: Signal<number | null>;
};

/** One rendered slot of the trail: a crumb, or the control holding the crumbs that didn't fit. */
export type BreadcrumbRenderItem =
  { type: 'item'; item: BreadcrumbCrumb } | { type: 'overflow'; items: BreadcrumbCrumb[] };
