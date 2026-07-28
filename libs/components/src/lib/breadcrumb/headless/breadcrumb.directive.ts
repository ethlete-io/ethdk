import {
  Directive,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { RuntimeError, signalHostElementScrollState } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BreadcrumbLabels, injectBreadcrumbLabels } from '../breadcrumb-labels';
import { BreadcrumbCrumb, BreadcrumbRenderItem } from '../breadcrumb.types';
import { BREADCRUMB_TOKEN } from './breadcrumb.tokens';
import { BreadcrumbItemTemplateDirective, BreadcrumbSeparatorDirective } from './breadcrumb-templates.directive';

/** Below this many crumbs there is nothing worth hiding: first + overflow + last is the collapsed shape. */
const MIN_COLLAPSIBLE_ITEMS = 3;

/**
 * Headless breadcrumb: owns the trail, decides how much of it fits, and exposes the slots to render. It
 * is the navigation landmark itself (`role="navigation"` + a label), so the element you put it on is the
 * `<nav>`.
 *
 * The trail comes from crumb templates declared inside it, or — in the shell's outlet — from the `crumbs`
 * input, which the breadcrumb manager composes out of every registered segment. When the trail is wider
 * than the space available, the middle crumbs move into an overflow slot; first and last stay visible.
 *
 * @example
 * <nav etBreadcrumb>
 *   <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem routerLink="/">Home</a></ng-template>
 *   <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>Invoice 4711</span></ng-template>
 * </nav>
 */
@Directive({
  selector: '[etBreadcrumb]',
  exportAs: 'etBreadcrumb',
  providers: [{ provide: BREADCRUMB_TOKEN, useExisting: BreadcrumbDirective }],
  host: {
    role: 'navigation',
    '[attr.aria-label]': 'resolvedLabels().navigation',
    '[attr.data-collapsed]': 'isCollapsed() ? "" : null',
  },
})
export class BreadcrumbDirective {
  private injectedLabels = injectBreadcrumbLabels();

  /**
   * Move the middle crumbs into an overflow control when the trail doesn't fit. Turn it off to let the
   * trail be clipped (or wrapped, or scrolled) by your own CSS instead. @default true
   */
  public collapse = input(true, { transform: booleanAttribute });

  /**
   * Per-instance overrides for the breadcrumb's accessible labels, merged over the injected
   * `BREADCRUMB_LABELS`. Prefer `provideBreadcrumbLabels` for app-wide localization.
   */
  public labels = input<Partial<BreadcrumbLabels> | null>(null);

  /**
   * The trail, supplied from outside. This is how `<et-breadcrumb-outlet>` renders a trail composed from
   * the registered segments: those crumb templates are declared in views this element doesn't contain, so
   * no content query could reach them. `null` (the default) uses the crumbs declared inside instead.
   */
  public crumbs = input<readonly BreadcrumbCrumb[] | null>(null);

  /** Crumbs declared as content of this element — the direct, non-routed way to build a trail. */
  private declaredCrumbs = contentChildren(BreadcrumbItemTemplateDirective, { descendants: true });

  /** @internal The `etBreadcrumbSeparator` slot, when one is projected. */
  public separatorTemplate = contentChild(BreadcrumbSeparatorDirective, { descendants: true });

  /** The trail this breadcrumb renders, from whichever of the two sources is in play. */
  public items = computed<readonly BreadcrumbCrumb[]>(() => this.crumbs() ?? this.declaredCrumbs());

  // Watches the host: `scroll.width > client.width` is the "doesn't fit" signal, and it re-measures on
  // resize *and* on DOM mutations — which is what makes a crumb's label arriving late trigger a recheck.
  private scrollState = signalHostElementScrollState();

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<BreadcrumbLabels>(() => ({ ...this.injectedLabels, ...this.labels() }));

  /**
   * The width the full trail needs, measured the one time it didn't fit. Kept as state rather than
   * derived, because it can only be measured while the trail *is* fully rendered — once collapsed, the
   * host measures the collapsed width and says nothing about what the full trail would need. Reset
   * whenever the trail changes, since new crumbs mean a new width.
   */
  private fullTrailWidth = linkedSignal<readonly BreadcrumbCrumb[], number | null>({
    source: () => this.items(),
    computation: () => null,
  });

  /** The space the trail has, from the reactive host dimensions (not a `clientWidth` read at call time). */
  private availableWidth = computed(() => this.scrollState().elementDimensions.client?.width ?? 0);

  /** Whether the middle crumbs are currently hidden behind the overflow control. */
  public isCollapsed = computed(() => {
    if (!this.collapse() || this.items().length < MIN_COLLAPSIBLE_ITEMS) return false;

    const fullTrailWidth = this.fullTrailWidth();

    if (fullTrailWidth === null) return false;

    return this.availableWidth() < fullTrailWidth;
  });

  /** The slots to render: every crumb, or first + overflow + last once collapsed. */
  public renderedItems = computed<BreadcrumbRenderItem[]>(() => {
    const items = this.items();
    const asItems = () => items.map((item): BreadcrumbRenderItem => ({ type: 'item', item }));

    if (!this.isCollapsed()) return asItems();

    const first = items[0];
    const last = items[items.length - 1];

    if (!first || !last) return asItems();

    return [
      { type: 'item', item: first },
      { type: 'overflow', items: items.slice(1, -1) },
      { type: 'item', item: last },
    ];
  });

  constructor() {
    // A crumb can't tell where it sits in a trail that may be composed from several segments, so the one
    // place that knows the whole trail marks its end — that is what carries `aria-current="page"`.
    effect(() => {
      const items = this.items();

      untracked(() => {
        for (const [index, item] of items.entries()) {
          item.isLast.set(index === items.length - 1);
        }
      });
    });

    effect(() => {
      const dimensions = this.scrollState().elementDimensions;

      untracked(() => {
        // A measurement taken while collapsed describes the collapsed trail, so it must not overwrite
        // the remembered full width — that is the number the trail is re-expanded against.
        if (!this.collapse() || this.isCollapsed()) return;

        const client = dimensions.client?.width ?? 0;
        const scroll = dimensions.scroll?.width ?? 0;

        // ignore pre-layout zeros, and anything that still fits
        if (client === 0 || scroll <= client) return;

        this.fullTrailWidth.set(scroll);
      });
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (this.items().length === 0) {
          throw new RuntimeError(
            BREADCRUMB_ERROR_CODES.MISSING_ITEMS,
            '[BreadcrumbDirective] This breadcrumb has no crumbs. Declare an <ng-template etBreadcrumbItemTemplate> ' +
              'per crumb inside it, or bind a composed trail via [crumbs] (which is what et-breadcrumb-outlet does).',
          );
        }
      });
    }
  }
}
