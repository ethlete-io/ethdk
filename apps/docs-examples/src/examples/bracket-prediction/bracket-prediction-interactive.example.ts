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
  BRACKET_IMPORTS,
  BRACKET_PICK_CARD_IMPORTS,
  BracketDefaultRoundHeaderComponent,
  BracketMatch,
  BracketRound,
  BracketRoundSwissGroup,
  createBracket,
  isBracketSlotPredictable,
  MatchParticipantSide,
  NormalizedMatch,
  NormalizedMatchParticipant,
  NormalizedMatchSideState,
  provideBracketConfig,
  resolveBracketSlot,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
  singleEliminationBracketLayout,
} from '@ethlete/components';
import { PARTICIPANTS, PREDICTION_SOURCE } from './bracket-prediction-interactive.data';

type Picks = {
  pickedSide: (match: BracketMatch<unknown, unknown>) => MatchParticipantSide | null;
  normalizedMatch: (match: BracketMatch<unknown, unknown>) => NormalizedMatch;
  pick: (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) => void;
};

const PICKS = new InjectionToken<Picks>('PICKS');

@Component({
  selector: 'app-pick-cell',
  template: `
    <et-bracket-pick-card
      [bracketMatch]="bracketMatch()"
      [normalized]="normalized()"
      [pickedSide]="pickedSide()"
      (pick)="picks.pick(bracketMatch(), $event)"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_PICK_CARD_IMPORTS],
})
export class PickCellComponent {
  protected picks = inject(PICKS);

  public bracketRound = input.required<BracketRound<unknown, unknown>>();
  public bracketMatch = input.required<BracketMatch<unknown, unknown>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, unknown> | null>();

  protected normalized = computed(() => this.picks.normalizedMatch(this.bracketMatch()));
  protected pickedSide = computed(() => this.picks.pickedSide(this.bracketMatch()));
}

@Component({
  selector: 'app-bracket-prediction-interactive-example',
  template: `
    <div [style.max-inline-size.px]="900">
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket
          [source]="source"
          [matchComponent]="pickCell"
          [finalMatchComponent]="pickCell"
          [matchHeight]="104"
          [finalMatchHeight]="104"
          [finalColumnWidth]="250"
          disableJourneyHighlight
        />
      </et-scrollable>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BRACKET_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  providers: [
    provideBracketConfig({
      layouts: [singleEliminationBracketLayout()],
      roundHeaderComponent: BracketDefaultRoundHeaderComponent,
    }),
    { provide: PICKS, useExisting: forwardRef(() => BracketPredictionInteractiveExampleComponent) },
  ],
})
export class BracketPredictionInteractiveExampleComponent implements Picks {
  private winners = signal<Record<string, string>>({});

  private bracket = computed<Bracket<unknown, unknown>>(() =>
    createBracket(PREDICTION_SOURCE, { layout: 'left-to-right' }),
  );

  public source = PREDICTION_SOURCE;
  public pickCell = PickCellComponent;

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
