import { booleanAttribute, computed, Directive, input, model, numberAttribute, signal } from '@angular/core';
import { StandingPick, standingPickStartOrder } from '@ethlete/bracket';
import { NormalizedMatchParticipant } from '../../match';
import { injectStandingsLabels, StandingsLabels } from '../standings-labels';
import { StandingsPickMarkDirective } from './standings-pick-mark.directive';

/** One row of a pick list: who sits on a position, and what that position means. */
export type StandingsPickRow = {
  participant: NormalizedMatchParticipant;
  /** Where they sit in the current order, 1-based. */
  position: number;
  /** Whether the position is on the advancing side of the cut. */
  isAdvancing: boolean;
  /** Whether the cut belongs under this row - the last advancing position, with rows still to come. */
  isLastAdvancing: boolean;
};

/** A move of one row, by 0-based index. */
export type StandingsPickMove = {
  from: number;
  to: number;
};

/**
 * Headless group picks: owns the order a viewer arranges a group table into, where it starts from, and
 * where the advancing cut falls.
 *
 * It imposes no markup and knows nothing about pointers or keys - a caller turns a drag, an arrow key or a
 * "reset" button into the same {@link StandingsPickDirective.move} call. The default `et-standings-pick`
 * draws it; a consumer who wants their own layout reads the same state.
 *
 * @example
 * <ul [participants]="teams()" [advancingCount]="2" etStandingsPick #pick="etStandingsPick">
 *   @for (row of pick.rows(); track row.participant.id) { … }
 * </ul>
 */
@Directive({
  selector: '[etStandingsPick]',
  exportAs: 'etStandingsPick',
  host: {
    '[attr.data-locked]': 'locked() ? "" : null',
  },
})
export class StandingsPickDirective {
  private injectedLabels = injectStandingsLabels();

  /** The participants of the group, in the order the backend listed them. */
  public participants = input.required<readonly NormalizedMatchParticipant[]>();

  /** Picks already stored, by position - what the order starts as before anyone moves a row. @default [] */
  public storedPicks = input<readonly StandingPick[]>([]);

  /** How many positions advance. The cut sits after the last of them; `0` draws none. @default 0 */
  public advancingCount = input(0, { transform: numberAttribute });

  /** Refuse every move, keeping the order readable. @default false */
  public locked = input(false, { transform: booleanAttribute });

  /**
   * The order on screen, as participant ids. Bind it two-way to own the order - a draft to submit, a reset
   * button, an order restored from elsewhere. Left `null` it follows `participants` and `storedPicks`.
   */
  public order = model<readonly string[] | null>(null);

  /** Override this instance's strings - see {@link provideStandingsLabels} for the app-wide version. */
  public labels = input<Partial<StandingsLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<StandingsLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /** The order a list with no `order` bound opens in: the stored picks on their positions, the rest behind. */
  public startOrder = computed(() =>
    standingPickStartOrder({
      participantIds: this.participants().map((participant) => participant.id),
      picks: this.storedPicks(),
    }),
  );

  /** The order actually drawn - `order` when one is bound, {@link startOrder} otherwise. */
  public resolvedOrder = computed<readonly string[]>(() => this.order() ?? this.startOrder());

  /** The template a row's mark slot is filled with, registered by `ng-template[etStandingsPickMark]`. */
  public registeredMarkTemplate = signal<StandingsPickMarkDirective | null>(null);

  /** Every row in the order it is drawn - what a template iterates. */
  public rows = computed<StandingsPickRow[]>(() => {
    const byId = new Map(this.participants().map((participant) => [participant.id, participant]));
    const advancingCount = this.advancingCount();
    const order = this.resolvedOrder();

    return order.flatMap((id, index) => {
      const participant = byId.get(id);

      if (!participant) return [];

      const position = index + 1;

      return [
        {
          participant,
          position,
          isAdvancing: position <= advancingCount,
          isLastAdvancing: position === advancingCount && position < order.length,
        },
      ];
    });
  });

  /**
   * Move the row at `from` to `to`, both 0-based.
   *
   * Does nothing while the list is locked, and nothing when either index is outside it - an index is never
   * clamped, so an arrow key on the first or the last row leaves the order as it is instead of moving the
   * row somewhere the user did not ask for.
   */
  public move(move: StandingsPickMove) {
    const { from, to } = move;

    if (this.locked() || from === to) return;

    const order = [...this.resolvedOrder()];

    if (from < 0 || from >= order.length || to < 0 || to >= order.length) return;

    const [moved] = order.splice(from, 1);

    if (moved === undefined) return;

    order.splice(to, 0, moved);
    this.order.set(order);
  }
}
