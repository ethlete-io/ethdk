import {
  Directive,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError, signalHostElementScrollState } from '@ethlete/core';
import { BREADCRUMB_ERROR_CODES } from '../breadcrumb-errors';
import { BreadcrumbLabels, injectBreadcrumbLabels } from '../breadcrumb-labels';
import { BreadcrumbCrumb, BreadcrumbRenderItem } from '../breadcrumb.types';
import { BREADCRUMB_COLLAPSE_TOKEN, BREADCRUMB_TOKEN } from './breadcrumb.tokens';
import { BreadcrumbItemTemplateDirective, BreadcrumbSeparatorDirective } from './breadcrumb-templates.directive';

const MIN_COLLAPSIBLE_ITEMS = 3;

/**
 * Headless breadcrumb: owns the trail, decides how much of it fits, and exposes the slots to render. It
 * is the navigation landmark itself (`role="navigation"` + a label), so the element you put it on is the
 * `<nav>`.
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
    '[attr.data-measuring]': 'isMeasuring() ? "" : null',
  },
})
export class BreadcrumbDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injectedLabels = injectBreadcrumbLabels();

  private collapseAffordance = inject(BREADCRUMB_COLLAPSE_TOKEN, { optional: true });

  /**
   * Move the middle crumbs into an overflow control when the trail doesn't fit. Turn it off to let the
   * trail be clipped (or wrapped, or scrolled) by your own CSS instead.
   *
   * Only has an effect where the collapse affordance is present: apply `etBreadcrumbCollapse` from
   * `BREADCRUMB_COLLAPSE_IMPORTS` to the breadcrumb (or any ancestor, e.g. the app shell). @default true
   */
  public collapse = input(true, { transform: booleanAttribute });

  /**
   * Per-instance overrides for the breadcrumb's accessible labels, merged over the injected
   * `BREADCRUMB_LABELS`. Prefer `provideBreadcrumbLabels` for app-wide localization.
   */
  public labels = input<Partial<BreadcrumbLabels> | null>(null);

  /** The trail, supplied from outside. `null` (the default) uses the crumbs declared inside instead. */
  public crumbs = input<readonly BreadcrumbCrumb[] | null>(null);

  private declaredCrumbs = contentChildren(BreadcrumbItemTemplateDirective, { descendants: true });

  /** @internal */
  public separatorTemplate = contentChild(BreadcrumbSeparatorDirective, { descendants: true });

  private canCollapse = computed(() => this.collapse() && !!this.collapseAffordance);

  /** @internal */
  public overflowComponent = this.collapseAffordance?.overflowComponent ?? null;

  /** The trail this breadcrumb renders, from whichever of the two sources is in play. */
  public items = computed<readonly BreadcrumbCrumb[]>(() => this.crumbs() ?? this.declaredCrumbs());

  private scrollState = signalHostElementScrollState();

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<BreadcrumbLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /** The width the full trail needs, measured the one time it didn't fit. */
  private fullTrailWidth = linkedSignal<readonly BreadcrumbCrumb[], number | null>({
    source: () => this.items(),
    computation: () => null,
  });

  private availableWidth = computed(() => this.scrollState().elementDimensions.client?.width ?? 0);

  private hasMeasured = signal(false);

  /** Whether the middle crumbs are currently hidden behind the overflow control. */
  public isCollapsed = computed(() => {
    if (!this.canCollapse() || this.items().length < MIN_COLLAPSIBLE_ITEMS) return false;

    const fullTrailWidth = this.fullTrailWidth();

    if (fullTrailWidth === null) return false;

    return this.availableWidth() < fullTrailWidth;
  });

  /**
   * Whether a measurement taken while the trail was expanded showed it fitting. Cleared on every change
   * of the collapsed state, so re-expanding always has to prove the fit again.
   */
  private fitConfirmed = linkedSignal<boolean, boolean>({
    source: () => this.isCollapsed(),
    computation: () => false,
  });

  /** @internal */
  public isMeasuring = computed(() => {
    if (!this.canCollapse() || this.items().length < MIN_COLLAPSIBLE_ITEMS) return false;
    if (!this.hasMeasured()) return true;

    return this.fullTrailWidth() !== null && !this.isCollapsed() && !this.fitConfirmed();
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
      const items = this.items();

      untracked(() => {
        for (const [index, item] of items.entries()) {
          item.isLast.set(index === items.length - 1);
        }
      });
    });

    // Every measurement has to be read here rather than out of the observers: a render hook runs after
    // change detection but before the browser paints, so it sees the trail that is about to be painted,
    // while the observers report the DOM as it was before the collapsed and full trail were swapped.
    // `scrollState` - the host's dimensions or content changed - is the only thing that may be read
    // reactively: every other signal in play is one `recordMeasurement` writes, so reading it here would
    // make the effect schedule itself.
    afterRenderEffect({
      earlyRead: () => {
        this.scrollState();

        const element = this.elementRef.nativeElement;

        untracked(() => this.recordMeasurement(element.clientWidth, element.scrollWidth));
      },
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (this.items().length === 0) {
          throw new RuntimeError(
            BREADCRUMB_ERROR_CODES.MISSING_ITEMS,
            '[BreadcrumbDirective] This breadcrumb has no crumbs. Declare an <ng-template etBreadcrumbItemTemplate> ' +
              'per crumb inside it, or bind a composed trail via [crumbs] (which is what et-breadcrumb-outlet does).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  private recordMeasurement(client: number, scroll: number) {
    if (client === 0) return;

    this.hasMeasured.set(true);

    // A measurement taken while collapsed describes the collapsed trail, so it must not overwrite the
    // remembered full width - that is the number the trail is re-expanded against.
    if (!this.canCollapse() || this.isCollapsed()) return;

    if (scroll <= client) {
      this.fitConfirmed.set(true);

      return;
    }

    this.fullTrailWidth.set(scroll);
  }
}
