import {
  Component,
  computed,
  forwardRef,
  inject,
  InjectionToken,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  Bracket,
  BracketDataSource,
  BracketMatch,
  BracketRound,
  BracketRoundSwissGroup,
  BracketSlotSource,
  MatchParticipantSide,
  createBracket,
  isBracketSlotPredictable,
  resolveBracketSlot,
} from '@ethlete/bracket';
import { NormalizedMatch, NormalizedMatchParticipant, NormalizedMatchSideState } from '../../match';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../../scrollable/scrollable.imports';
import { BracketPickCardComponent } from '../bracket-pick-card.component';
import { BracketComponent } from '../bracket.component';
import { singleEliminationBracketLayout } from '../layouts';

const matchOutcome = (matchId: string): BracketSlotSource => ({
  kind: 'match-outcome',
  role: 'winner',
  matchId,
  standingId: null,
  rank: null,
  label: null,
});

const PREDICTION_SOURCE: BracketDataSource<null, null> = {
  mode: 'single-elimination',
  rounds: [
    { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
    { id: 'final', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'semi-1', roundId: 'semi-finals', home: 'red', away: 'blue', winner: null, status: 'pending', data: null },
    { id: 'semi-2', roundId: 'semi-finals', home: 'gold', away: 'green', winner: null, status: 'pending', data: null },
    {
      id: 'final',
      roundId: 'final',
      home: null,
      away: null,
      homeSource: matchOutcome('semi-1'),
      awaySource: matchOutcome('semi-2'),
      winner: null,
      status: 'pending',
      data: null,
    },
  ],
};

const PARTICIPANTS: Record<string, NormalizedMatchParticipant> = {
  red: { id: 'red', name: 'Red Foxes', code: 'FOX', subtitle: null, emblem: null, seed: 1 },
  blue: { id: 'blue', name: 'Blue Whales', code: 'BLU', subtitle: null, emblem: null, seed: 4 },
  gold: { id: 'gold', name: 'Golden Owls', code: 'OWL', subtitle: null, emblem: null, seed: 2 },
  green: { id: 'green', name: 'Green Bears', code: 'GRN', subtitle: null, emblem: null, seed: 3 },
};

type PredictionStoryState = {
  bracket: () => Bracket<unknown, unknown>;
  pickedSide: (match: BracketMatch<unknown, unknown>) => MatchParticipantSide | null;
  normalizedMatch: (match: BracketMatch<unknown, unknown>) => NormalizedMatch;
  pick: (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) => void;
};

const PREDICTION_STORY_STATE = new InjectionToken<PredictionStoryState>('PREDICTION_STORY_STATE');

@Component({
  selector: 'et-sb-bracket-pick-card',
  template: `
    <et-bracket-pick-card
      [bracketMatch]="bracketMatch()"
      [normalized]="normalized()"
      [pickedSide]="pickedSide()"
      (pick)="state.pick(bracketMatch(), $event)"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketPickCardComponent],
})
export class StorybookBracketPickCardComponent {
  protected state = inject(PREDICTION_STORY_STATE);

  public bracketRound = input.required<BracketRound<unknown, unknown>>();
  public bracketMatch = input.required<BracketMatch<unknown, unknown>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, unknown> | null>();

  protected normalized = computed(() => this.state.normalizedMatch(this.bracketMatch()));
  protected pickedSide = computed(() => this.state.pickedSide(this.bracketMatch()));
}

@Component({
  selector: 'et-sb-bracket-prediction',
  template: `
    <div [style.max-inline-size.px]="760">
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket
          [source]="SOURCE"
          [layouts]="LAYOUTS"
          [matchComponent]="PICK_CARD"
          [finalMatchComponent]="PICK_CARD"
          [matchHeight]="104"
          [finalMatchHeight]="104"
          [finalColumnWidth]="250"
        />
      </et-scrollable>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketComponent, ...SCROLLABLE_IMPORTS, ...SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    {
      provide: PREDICTION_STORY_STATE,
      useExisting: forwardRef(() => StorybookBracketPredictionComponent),
    },
  ],
})
export class StorybookBracketPredictionComponent implements PredictionStoryState {
  private winners = signal<Record<string, string>>({});

  public bracket = computed<Bracket<unknown, unknown>>(() =>
    createBracket(PREDICTION_SOURCE, { layout: 'left-to-right' }),
  );

  protected readonly SOURCE = PREDICTION_SOURCE;
  protected readonly LAYOUTS = [singleEliminationBracketLayout()];
  protected readonly PICK_CARD = StorybookBracketPickCardComponent;

  public pickedSide(match: BracketMatch<unknown, unknown>): MatchParticipantSide | null {
    const pickedParticipantId = this.winners()[match.id];

    if (!pickedParticipantId) return null;

    const normalized = this.normalizedMatch(match);

    return normalized.home?.id === pickedParticipantId
      ? 'home'
      : normalized.away?.id === pickedParticipantId
        ? 'away'
        : null;
  }

  public normalizedMatch(match: BracketMatch<unknown, unknown>): NormalizedMatch {
    const home = this.resolveParticipant(match, 'home');
    const away = this.resolveParticipant(match, 'away');

    return {
      id: match.id,
      status: 'scheduled',
      startTime: null,
      home,
      away,
      homeState: this.sideState({ match, side: 'home', participant: home }),
      awayState: this.sideState({ match, side: 'away', participant: away }),
      homeScore: null,
      awayScore: null,
      resultKind: 'score',
      gameScores: null,
      winnerSide: null,
      label: null,
    };
  }

  public pick(match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) {
    const participant = this.normalizedMatch(match)[side];

    if (!participant) return;

    this.winners.update((current) => ({ ...current, [match.id]: participant.id }));
  }

  private resolveParticipant(match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) {
    const participantId = resolveBracketSlot({
      bracket: this.bracket(),
      picks: {
        matchWinner: (matchId) => this.winners()[matchId] ?? null,
        standingRank: () => null,
      },
      matchId: match.id,
      side,
    });

    return participantId ? (PARTICIPANTS[participantId] ?? null) : null;
  }

  private sideState(options: {
    match: BracketMatch<unknown, unknown>;
    side: MatchParticipantSide;
    participant: NormalizedMatchParticipant | null;
  }): NormalizedMatchSideState {
    const { match, side, participant } = options;

    if (match[side]) return 'occupied';
    if (participant) return 'predicted';

    const source = side === 'home' ? match.homeSource : match.awaySource;

    return isBracketSlotPredictable(source) ? 'unresolvable' : 'unavailable';
  }
}
