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
import { BREADCRUMB_TOKEN } from './breadcrumb.tokens';
import { BreadcrumbItemTemplateDirective, BreadcrumbSeparatorDirective } from './breadcrumb-templates.directive';

/** Below this many crumbs there is nothing worth hiding: first + overflow + last is the collapsed shape. */
const MIN_COLLAPSIBLE_ITEMS = 3;

/** One rendered slot of the trail: a crumb, or the control holding the crumbs that didn't fit. */
export type BreadcrumbRenderItem =
  | { type: 'item'; item: BreadcrumbItemTemplateDirective }
  | { type: 'overflow'; items: BreadcrumbItemTemplateDirective[] };

/**
 * Headless breadcrumb: owns the registered crumb templates, decides how many of them fit, and exposes
 * the slots to render. It is the navigation landmark itself (`role="navigation"` + a label), so the
 * element you put it on is the `<nav>`.
 *
 * The trail is authored by the page as a list of `<ng-template etBreadcrumbItemTemplate>`s, which is
 * what lets a crumb be a router link, plain text, or a placeholder while its name is still loading.
 * When the trail is wider than the space available, the middle crumbs move into an overflow slot —
 * first and last always stay visible.
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
   * The trail, in DOM order. A content query rather than the self-registration the other domains use:
   * order *is* the meaning of a breadcrumb, and only Angular's query keeps it right when a `@for` moves
   * a crumb (a moved view re-registers nothing, and template anchors are comment nodes whose relative
   * position is not reliably comparable).
   */
  public items = contentChildren(BreadcrumbItemTemplateDirective, { descendants: true });

  /** @internal The `etBreadcrumbSeparator` slot, when one is projected. */
  public separatorTemplate = contentChild(BreadcrumbSeparatorDirective, { descendants: true });

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
  private fullTrailWidth = linkedSignal<readonly BreadcrumbItemTemplateDirective[], number | null>({
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
            '[BreadcrumbDirective] No <ng-template etBreadcrumbItemTemplate> was found inside this breadcrumb, so it ' +
              'has no trail to render. Declare one template per crumb.',
          );
        }
      });
    }
  }
}
