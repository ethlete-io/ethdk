import { DestroyRef, Directive, inject, input, signal } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';
import { injectBreadcrumbManager } from '../breadcrumb-manager';
import { BreadcrumbCrumb } from '../breadcrumb.types';
import { BREADCRUMB_SEGMENT_TOKEN } from './breadcrumb.tokens';

/**
 * This view's contribution to the trail: the crumbs it owns, and nothing above it. Declare one in every
 * routed view that adds a level, and the `<et-breadcrumb-outlet>` in the shell renders all the
 * registered segments as a single trail — so a deep page contributes one crumb rather than restating
 * the whole path.
 *
 * The segment renders nothing itself; it only declares crumb templates. Registration lasts as long as
 * the declaring view, so navigating away drops exactly that view's crumbs.
 *
 * Trail order is the order segments register, which under the router is view-creation order (outermost
 * route first). Declare the segment **unconditionally** to keep that true — a segment behind an `@if`
 * that flips later registers after its own children. When a crumb's label isn't there yet, mark the
 * crumb `loading` instead of withholding the segment. `order` is the escape hatch for a structure that
 * can't follow this.
 *
 * @example
 * // teams-detail-view.component.ts — contributes just the team's own crumb
 * <ng-template etBreadcrumbSegment>
 *   <ng-template etBreadcrumbItemTemplate [loading]="team.isLoading()">
 *     <span etBreadcrumbItem>{{ team.name() }}</span>
 *   </ng-template>
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etBreadcrumbSegment]',
  exportAs: 'etBreadcrumbSegment',
  providers: [{ provide: BREADCRUMB_SEGMENT_TOKEN, useExisting: BreadcrumbSegmentDirective }],
})
export class BreadcrumbSegmentDirective {
  private manager = injectBreadcrumbManager();

  public templateRef = injectTemplateRef();

  /**
   * Explicit position in the trail, for a structure whose view-creation order doesn't match its
   * hierarchy. Segments without one keep their registration index, and the two are compared on the same
   * scale — so `order="0"` pins a segment to the front. @default null
   */
  public order = input<number | null>(null);

  /** The crumbs declared inside this segment, in declaration order. */
  public crumbs = signal<BreadcrumbCrumb[]>([]);

  constructor() {
    this.manager.registerSegment(this);

    inject(DestroyRef).onDestroy(() => this.manager.unregisterSegment(this));
  }

  /** @internal Called by a crumb template inside this segment while it exists. */
  public registerCrumb(crumb: BreadcrumbCrumb) {
    this.crumbs.update((crumbs) => [...crumbs, crumb]);
  }

  /** @internal */
  public unregisterCrumb(crumb: BreadcrumbCrumb) {
    this.crumbs.update((crumbs) => crumbs.filter((registered) => registered !== crumb));
  }
}
