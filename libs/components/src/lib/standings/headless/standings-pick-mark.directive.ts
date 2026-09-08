import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { STANDINGS_ERROR_CODES } from '../standings-errors';
import { StandingsPickDirective, StandingsPickRow } from './standings-pick.directive';

export type StandingsPickMarkContext = {
  $implicit: StandingsPickRow;
  index: number;
};

/**
 * Fills the slot at the end of every pick row with the app's own mark - what the pick scored, a check, a
 * cross, the position it turned out to be. Whether a pick was right is the app's data, so the list draws
 * nothing there by itself.
 *
 * @example
 * <et-standings-pick [participants]="teams()" [advancingCount]="2">
 *   <ng-template let-row etStandingsPickMark>
 *     <span>{{ pointsOf(row.participant.id) }}</span>
 *   </ng-template>
 * </et-standings-pick>
 */
@Directive({
  selector: 'ng-template[etStandingsPickMark]',
  exportAs: 'etStandingsPickMark',
})
export class StandingsPickMarkDirective {
  private pick = inject(StandingsPickDirective, { optional: true });
  private destroyRef = inject(DestroyRef);
  private hostElement = injectHostElement<Comment>();

  public templateRef = inject<TemplateRef<StandingsPickMarkContext>>(TemplateRef);

  constructor() {
    if (ngDevMode && this.pick?.registeredMarkTemplate()) {
      throw new RuntimeError(
        STANDINGS_ERROR_CODES.DUPLICATE_MARK_TEMPLATE,
        '[StandingsPickMarkDirective] An et-standings-pick accepts only one ng-template[etStandingsPickMark]. ' +
          'Remove the extra template.',
        { element: this.hostElement },
      );
    }

    this.pick?.registeredMarkTemplate.set(this);

    this.destroyRef.onDestroy(() => {
      if (this.pick?.registeredMarkTemplate() === this) {
        this.pick.registeredMarkTemplate.set(null);
      }
    });
  }
}
