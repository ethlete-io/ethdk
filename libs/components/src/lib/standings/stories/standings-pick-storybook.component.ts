import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import {
  STANDING_PICK_OUTCOME,
  StandingPick,
  StandingPickOutcome,
  standingPickOutcome,
  standingPickStartOrder,
} from '@ethlete/bracket';
import { ProvideColorDirective, ProvideSurfaceDirective } from '@ethlete/core';
import { NormalizedMatchParticipant } from '../../match';
import { STANDINGS_PICK_IMPORTS } from '../standings.imports';

@Component({
  selector: 'et-sb-standings-pick',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-4">
        <p class="text-small m-0 opacity-60">
          Grab a row and drag it, or Tab to its handle and press ArrowUp / ArrowDown. The line marks where the advancing
          places end. Turn <code>locked</code> on for the scored state - the numbers on the right are the app's, worked
          out from <code>standingPickOutcome</code>.
        </p>

        <div [style.inline-size]="boxWidth()">
          <et-standings-pick
            [(order)]="order"
            [participants]="participants()"
            [storedPicks]="storedPicks()"
            [advancingCount]="advancingCount()"
            [locked]="locked()"
          >
            @if (locked()) {
              <ng-template let-row etStandingsPickMark>
                @if (marks()[row.participant.id]; as mark) {
                  <span
                    [etProvideColor]="mark.color"
                    [title]="mark.outcome"
                    class="text-small"
                    style="color: var(--et-theme-color-ink-solid)"
                  >
                    {{ mark.points }}
                  </span>
                }
              </ng-template>
            }
          </et-standings-pick>
        </div>

        @if (locked()) {
          <p class="text-small m-0 opacity-60">{{ total() }} points from this group</p>
        }
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [STANDINGS_PICK_IMPORTS, ProvideSurfaceDirective, ProvideColorDirective],
})
export class StandingsPickStorybookComponent {
  public surface = input('dark');
  public width = input(420);
  public advancingCount = input(2);
  public locked = input(false);
  public withStoredPicks = input(true);

  protected participants = computed(() => PARTICIPANTS);

  protected order = signal<readonly string[] | null>(null);

  /** Caps at the viewport so a phone gets the list rather than a horizontal scrollbar. */
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);

  protected storedPicks = computed<StandingPick[]>(() => (this.withStoredPicks() ? STORED_PICKS : []));

  /** What the list opens in - the same helper `et-standings-pick` uses when no `order` is bound. */
  public startOrder = computed(() =>
    standingPickStartOrder({ participantIds: PARTICIPANTS.map((entry) => entry.id), picks: this.storedPicks() }),
  );

  public predicted = computed(() => this.order() ?? this.startOrder());

  protected marks = computed(() => {
    const advancingCount = this.advancingCount();

    return Object.fromEntries(
      this.predicted().map((id, index) => {
        const outcome = standingPickOutcomeOf({ id, predictedPosition: index + 1, advancingCount });

        return [id, { outcome, points: POINTS[outcome], color: MARK_COLORS[outcome] }];
      }),
    );
  });

  protected total = computed(() => Object.values(this.marks()).reduce((sum, mark) => sum + mark.points, 0));
}

// Below the component on purpose: an interpolated template literal above an inline `template:` breaks the
// Angular language service inside it.
const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const participant = (config: { id: string; name: string; code: string; fill: string }): NormalizedMatchParticipant => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: null,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: null,
});

const PARTICIPANTS: NormalizedMatchParticipant[] = [
  participant({ id: 'fcb', name: 'FC Berlin', code: 'FCB', fill: '#00ffa1' }),
  participant({ id: 'neo', name: 'Neon Esports', code: 'NEO', fill: '#00d0ff' }),
  participant({ id: 'rlp', name: 'Rote Löwen Pankow', code: 'RLP', fill: '#ffd000' }),
  participant({ id: 'haf', name: 'Hafen United', code: 'HAF', fill: '#ff7a00' }),
];

const STORED_PICKS: StandingPick[] = [{ position: 1, participantId: 'rlp' }];

/** Where the group really finished, for the scored state. */
const FINAL_POSITIONS: Record<string, number> = { rlp: 1, haf: 2, fcb: 3, neo: 4 };

/** The app's own point rules - the library scores an outcome, never a number of points. */
const POINTS: Record<StandingPickOutcome, number> = {
  [STANDING_PICK_OUTCOME.EXACT]: 5,
  [STANDING_PICK_OUTCOME.PARTIAL]: 3,
  [STANDING_PICK_OUTCOME.WRONG]: 0,
};

/** Storybook's registered color themes - an app names its own. */
const MARK_COLORS: Record<StandingPickOutcome, string> = {
  [STANDING_PICK_OUTCOME.EXACT]: 'success',
  [STANDING_PICK_OUTCOME.PARTIAL]: 'warning',
  [STANDING_PICK_OUTCOME.WRONG]: 'danger',
};

const standingPickOutcomeOf = (options: { id: string; predictedPosition: number; advancingCount: number }) =>
  standingPickOutcome({
    predictedPosition: options.predictedPosition,
    actualPosition: FINAL_POSITIONS[options.id] ?? options.predictedPosition,
    advancingCount: options.advancingCount,
  });
