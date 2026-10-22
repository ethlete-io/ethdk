import { Component, computed, ViewEncapsulation } from '@angular/core';
import {
  STANDING_PICK_OUTCOME,
  StandingPickOutcome,
  standingPickOutcome,
  standingPickStartOrder,
} from '@ethlete/bracket';
import { STANDINGS_PICK_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { FINAL_POSITIONS, PARTICIPANTS, STORED_PICKS } from './standings-pick-locked.data';

const ADVANCING_COUNT = 2;

const POINTS: Record<StandingPickOutcome, number> = {
  [STANDING_PICK_OUTCOME.EXACT]: 5,
  [STANDING_PICK_OUTCOME.PARTIAL]: 3,
  [STANDING_PICK_OUTCOME.WRONG]: 0,
};

const MARK_COLORS: Record<StandingPickOutcome, string> = {
  [STANDING_PICK_OUTCOME.EXACT]: 'success',
  [STANDING_PICK_OUTCOME.PARTIAL]: 'warning',
  [STANDING_PICK_OUTCOME.WRONG]: 'danger',
};

@Component({
  selector: 'app-standings-pick-locked-example',
  template: `
    <div [style.inline-size.px]="420" [style.max-inline-size]="'100%'">
      <et-standings-pick [participants]="participants" [storedPicks]="storedPicks" [advancingCount]="2" locked>
        <ng-template let-row etStandingsPickMark>
          @if (marks()[row.participant.id]; as mark) {
            <span
              [etProvideColor]="mark.color"
              [title]="mark.outcome"
              [style.color]="'var(--et-theme-color-ink-solid)'"
            >
              {{ mark.points }}
            </span>
          }
        </ng-template>
      </et-standings-pick>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_PICK_IMPORTS, ProvideColorDirective],
})
export class StandingsPickLockedExampleComponent {
  public participants = PARTICIPANTS;
  public storedPicks = STORED_PICKS;

  protected marks = computed(() => {
    const order = standingPickStartOrder({
      participantIds: PARTICIPANTS.map((entry) => entry.id),
      picks: STORED_PICKS,
    });

    return Object.fromEntries(
      order.map((id, index) => {
        const outcome = standingPickOutcome({
          predictedPosition: index + 1,
          actualPosition: FINAL_POSITIONS[id] ?? index + 1,
          advancingCount: ADVANCING_COUNT,
        });

        return [id, { outcome, points: POINTS[outcome], color: MARK_COLORS[outcome] }];
      }),
    );
  });
}
