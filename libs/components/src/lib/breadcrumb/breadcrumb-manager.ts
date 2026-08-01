import { computed, signal } from '@angular/core';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { BreadcrumbSegment } from './breadcrumb.types';

const BREADCRUMB_MANAGER_DEF = /* @__PURE__ */ defineProvider(
  () => {
    const registeredSegments = signal<BreadcrumbSegment[]>([]);

    /**
     * The registered segments in trail order. That order is **registration order** — which under the
     * router is view-creation order, i.e. outermost route first — unless a segment sets an explicit
     * `order`. See the guide's note on declaring segments unconditionally.
     */
    const segments = computed(() => {
      const positioned = registeredSegments().map((segment, index) => ({
        segment,
        key: segment.order() ?? index,
      }));

      // sort() is stable, so equal keys keep registration order
      return positioned.sort((a, b) => a.key - b.key).map(({ segment }) => segment);
    });

    /** Every crumb currently contributing to the trail, flattened in segment order. */
    const crumbs = computed(() => segments().flatMap((segment) => [...segment.crumbs()]));

    return {
      segments,
      crumbs,

      /** @internal Called by `etBreadcrumbSegment` while its declaring view is alive. */
      registerSegment: (segment: BreadcrumbSegment) => registeredSegments.update((segments) => [...segments, segment]),

      /** @internal */
      unregisterSegment: (segment: BreadcrumbSegment) =>
        registeredSegments.update((segments) => segments.filter((registered) => registered !== segment)),
    };
  },
  { name: 'Breadcrumb Manager' },
);

/**
 * Collects the trail from every view that is currently on screen. Each routed view registers only the
 * crumbs it owns via `<ng-template etBreadcrumbSegment>`; the single `<et-breadcrumb-outlet>` in the
 * shell renders all of them, in view order, as one trail. A page therefore never has to restate its
 * ancestors' crumbs — the layout route above it already contributed those.
 *
 * Provide it once, above the outlet and every view that contributes to the trail:
 *
 * @example
 * providers: [provideBreadcrumbManager()]
 */
export const provideBreadcrumbManager = /* @__PURE__ */ toProvideFn(BREADCRUMB_MANAGER_DEF);
export const injectBreadcrumbManager = /* @__PURE__ */ toInjectFn(BREADCRUMB_MANAGER_DEF);
