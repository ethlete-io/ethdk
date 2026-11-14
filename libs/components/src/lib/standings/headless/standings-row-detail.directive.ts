import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { STANDINGS_ERROR_CODES } from '../standings-errors';
import { NormalizedStandingRow } from '../standings.types';
import { StandingsDirective, StandingsRenderRow } from './standings.directive';

export type StandingsRowDetailContext = {
  $implicit: NormalizedStandingRow;
  renderRow: StandingsRenderRow;
  /** How many columns the table draws, for a full-width cell's `colspan`. */
  columnCount: number;
};

/**
 * Makes every standings row expandable. The template renders the detail's own `<tr>`s straight into the
 * table, so its cells can line up with the row's columns - or span them all with `columnCount`.
 *
 * @example
 * <et-standings [rows]="rows()" [(expandedRows)]="expanded">
 *   <ng-template let-row let-columnCount="columnCount" etStandingsRowDetail>
 *     <tr><td [attr.colspan]="columnCount">{{ row.participant?.name }}</td></tr>
 *   </ng-template>
 * </et-standings>
 */
@Directive({
  selector: 'ng-template[etStandingsRowDetail]',
  exportAs: 'etStandingsRowDetail',
})
export class StandingsRowDetailDirective {
  private standings = inject(StandingsDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement<Comment>();

  public templateRef = inject<TemplateRef<StandingsRowDetailContext>>(TemplateRef);

  public static ngTemplateContextGuard(
    _directive: StandingsRowDetailDirective,
    _context: unknown,
  ): _context is StandingsRowDetailContext {
    return true;
  }

  constructor() {
    if (ngDevMode && this.standings?.registeredRowDetailTemplate()) {
      throw new RuntimeError(
        STANDINGS_ERROR_CODES.DUPLICATE_ROW_DETAIL_TEMPLATE,
        '[StandingsRowDetailDirective] An et-standings accepts only one ng-template[etStandingsRowDetail]. ' +
          'Remove the extra template.',
        { element: this.hostElement },
      );
    }

    this.standings?.registeredRowDetailTemplate.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.standings?.registeredRowDetailTemplate() === this) {
        this.standings.registeredRowDetailTemplate.set(null);
      }
    });
  }
}
