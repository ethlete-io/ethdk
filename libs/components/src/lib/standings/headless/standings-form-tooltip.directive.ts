import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { NormalizedStandingRow, StandingsFormEntry } from '../standings.types';
import { StandingsDirective } from './standings.directive';

export type StandingsFormTooltipContext = {
  $implicit: StandingsFormEntry;
  row: NormalizedStandingRow;
};

/**
 * Replaces the text tooltip of a labelled form result with your own template, for a card instead of a
 * string. The template receives the form entry as `$implicit` and the row as `row`.
 *
 * @example
 * <et-standings [rows]="rows()">
 *   <ng-template let-entry let-row="row" etStandingsFormTooltip>{{ entry.label }} ({{ row.participant?.name }})</ng-template>
 * </et-standings>
 */
@Directive({
  selector: 'ng-template[etStandingsFormTooltip]',
  exportAs: 'etStandingsFormTooltip',
})
export class StandingsFormTooltipDirective {
  private standings = inject(StandingsDirective, { optional: true });
  private destroyRef = inject(DestroyRef);

  public templateRef = inject<TemplateRef<StandingsFormTooltipContext>>(TemplateRef);

  public static ngTemplateContextGuard(
    _directive: StandingsFormTooltipDirective,
    _context: unknown,
  ): _context is StandingsFormTooltipContext {
    return true;
  }

  constructor() {
    this.standings?.registeredFormTooltipTemplate.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.standings?.registeredFormTooltipTemplate() === this) {
        this.standings.registeredFormTooltipTemplate.set(null);
      }
    });
  }
}
