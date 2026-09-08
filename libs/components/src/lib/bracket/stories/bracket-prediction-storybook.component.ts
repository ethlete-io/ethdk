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
  BracketMatchId,
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
import { BracketPickCardComponent, BracketPickCardNoteTone } from '../bracket-pick-card.component';
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
    { id: 'quarter-finals', name: 'Quarter-finals', type: 'single-elimination-bracket', data: null },
    { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
    { id: 'final', name: 'Final', type: 'final', data: null },
  ],
  matches: [
    { id: 'qf-1', roundId: 'quarter-finals', home: 'red', away: 'iron', winner: null, status: 'pending', data: null },
    { id: 'qf-2', roundId: 'quarter-finals', home: 'gold', away: 'amber', winner: null, status: 'pending', data: null },
    {
      id: 'qf-3',
      roundId: 'quarter-finals',
      home: 'green',
      away: 'purple',
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'qf-4',
      roundId: 'quarter-finals',
      home: 'blue',
      away: 'silver',
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'semi-1',
      roundId: 'semi-finals',
      home: null,
      away: null,
      homeSource: matchOutcome('qf-1'),
      awaySource: matchOutcome('qf-2'),
      winner: null,
      status: 'pending',
      data: null,
    },
    {
      id: 'semi-2',
      roundId: 'semi-finals',
      home: null,
      away: null,
      homeSource: matchOutcome('qf-3'),
      awaySource: matchOutcome('qf-4'),
      winner: null,
      status: 'pending',
      data: null,
    },
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

const RED: NormalizedMatchParticipant = {
  id: 'red',
  name: 'Red Foxes',
  code: 'FOX',
  subtitle: null,
  emblem: null,
  seed: 1,
};
const BLUE: NormalizedMatchParticipant = {
  id: 'blue',
  name: 'Blue Whales',
  code: 'BLU',
  subtitle: null,
  emblem: null,
  seed: 4,
};
const GOLD: NormalizedMatchParticipant = {
  id: 'gold',
  name: 'Golden Owls',
  code: 'OWL',
  subtitle: null,
  emblem: null,
  seed: 2,
};
const GREEN: NormalizedMatchParticipant = {
  id: 'green',
  name: 'Green Bears',
  code: 'GRN',
  subtitle: null,
  emblem: null,
  seed: 3,
};

const SILVER: NormalizedMatchParticipant = {
  id: 'silver',
  name: 'Silver Sharks',
  code: 'SHK',
  subtitle: null,
  emblem: null,
  seed: 5,
};
const PURPLE: NormalizedMatchParticipant = {
  id: 'purple',
  name: 'Purple Panthers',
  code: 'PAN',
  subtitle: null,
  emblem: null,
  seed: 6,
};
const AMBER: NormalizedMatchParticipant = {
  id: 'amber',
  name: 'Amber Aces',
  code: 'ACE',
  subtitle: null,
  emblem: null,
  seed: 7,
};
const IRON: NormalizedMatchParticipant = {
  id: 'iron',
  name: 'Iron Ibises',
  code: 'IBS',
  subtitle: null,
  emblem: null,
  seed: 8,
};

const PARTICIPANTS: Record<string, NormalizedMatchParticipant> = {
  red: RED,
  blue: BLUE,
  gold: GOLD,
  green: GREEN,
  silver: SILVER,
  purple: PURPLE,
  amber: AMBER,
  iron: IRON,
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
    <div [style.max-inline-size.px]="900">
      <et-scrollable [etScrollableButtons]="{ sticky: true }">
        <et-bracket
          [source]="SOURCE"
          [layouts]="LAYOUTS"
          [matchComponent]="PICK_CARD"
          [finalMatchComponent]="PICK_CARD"
          [matchHeight]="104"
          [finalMatchHeight]="104"
          [finalColumnWidth]="250"
          disableJourneyHighlight
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

const slotSource = (overrides: Partial<BracketSlotSource> & Pick<BracketSlotSource, 'kind'>): BracketSlotSource => ({
  role: null,
  matchId: null,
  standingId: null,
  rank: null,
  label: null,
  ...overrides,
});

const finalOf = (awaySource: BracketSlotSource | null): BracketMatch<null, null> => {
  const bracket = createBracket<null, null>(
    {
      mode: 'single-elimination',
      rounds: [
        { id: 'semi-finals', name: 'Semi-finals', type: 'single-elimination-bracket', data: null },
        { id: 'final', name: 'Final', type: 'final', data: null },
      ],
      matches: [
        {
          id: 'semi-1',
          roundId: 'semi-finals',
          home: 'red',
          away: 'blue',
          winner: 'home',
          status: 'completed',
          data: null,
        },
        {
          id: 'final',
          roundId: 'final',
          home: 'red',
          away: null,
          homeSource: matchOutcome('semi-1'),
          awaySource,
          winner: null,
          status: 'pending',
          data: null,
        },
      ],
    },
    { layout: 'left-to-right' },
  );

  const final = bracket.matches.get('final' as BracketMatchId);

  if (!final) throw new Error('The demo source above must contain a match called "final".');

  return final;
};

const normalizedFinal = (options: {
  away?: NormalizedMatchParticipant | null;
  awayState?: NormalizedMatchSideState;
  winnerSide?: MatchParticipantSide | null;
}): NormalizedMatch => ({
  id: 'final',
  status: 'scheduled',
  startTime: null,
  home: RED,
  away: options.away ?? null,
  homeState: 'occupied',
  awayState: options.awayState ?? (options.away ? 'occupied' : 'unavailable'),
  homeScore: null,
  awayScore: null,
  resultKind: 'score',
  gameScores: null,
  winnerSide: options.winnerSide ?? null,
  label: null,
});

export type PickCardCase = {
  title: string;
  bracketMatch: BracketMatch<null, null>;
  normalized: NormalizedMatch;
  pickedSide: MatchParticipantSide | null;
  note: string | null;
  noteTone: BracketPickCardNoteTone;
  locked: boolean;
  disabled: boolean;
  readonly: boolean;
  earlierRoundsClosed: boolean;
};

const pickCardCase = (title: string, overrides: Partial<PickCardCase> = {}): PickCardCase => ({
  title,
  bracketMatch: finalOf(null),
  normalized: normalizedFinal({ away: GOLD }),
  pickedSide: null,
  note: null,
  noteTone: 'muted',
  locked: false,
  disabled: false,
  readonly: false,
  earlierRoundsClosed: false,
  ...overrides,
});

/** `unavailable` is the state a slot source words; an `unresolvable` side says "predict it" instead. */
const sourceCase = ({
  title,
  source,
  ...overrides
}: Partial<PickCardCase> & { title: string; source: BracketSlotSource | null }) =>
  pickCardCase(title, {
    bracketMatch: finalOf(source),
    normalized: normalizedFinal({ awayState: 'unavailable' }),
    ...overrides,
  });

const unresolvedCase = ({ title, ...overrides }: Partial<PickCardCase> & { title: string }) =>
  pickCardCase(title, {
    bracketMatch: finalOf(slotSource({ kind: 'match-outcome', role: 'winner' })),
    normalized: normalizedFinal({ awayState: 'unresolvable' }),
    ...overrides,
  });

export const PICK_CARD_SLOT_SOURCE_CASES: PickCardCase[] = [
  sourceCase({
    title: "match-outcome, the earlier match's winner",
    source: slotSource({ kind: 'match-outcome', role: 'winner' }),
  }),
  sourceCase({
    title: "match-outcome, the earlier match's loser",
    source: slotSource({ kind: 'match-outcome', role: 'loser' }),
  }),
  sourceCase({
    title: 'standing-rank',
    source: slotSource({ kind: 'standing-rank', standingName: 'Group A', rank: 2 }),
  }),
  sourceCase({ title: 'seed', source: slotSource({ kind: 'seed', seed: 3 }) }),
  sourceCase({ title: 'swiss-bucket', source: slotSource({ kind: 'swiss-bucket' }) }),
  sourceCase({ title: 'bye', source: slotSource({ kind: 'bye' }) }),
  sourceCase({ title: 'external', source: slotSource({ kind: 'external' }) }),
  sourceCase({ title: 'no source at all', source: null }),
  sourceCase({
    title: "the competition's own wording, which always wins",
    source: slotSource({ kind: 'seed', seed: 3, label: 'Host nation' }),
  }),
  unresolvedCase({ title: 'a side a prediction could still name' }),
  unresolvedCase({ title: 'the same side, with no earlier round left to predict', earlierRoundsClosed: true }),
];

export const PICK_CARD_STATE_CASES: PickCardCase[] = [
  pickCardCase('Picked, and still changeable', { pickedSide: 'home' }),
  pickCardCase('A muted note', {
    pickedSide: 'home',
    note: 'Followed Red Foxes from Semi-final 1',
  }),
  pickCardCase('An invalid note, which outlines the card too', {
    note: 'Blue Whales - no longer in this match',
    noteTone: 'invalid',
  }),
  pickCardCase('Locked - the deadline passed, the pick stays', { pickedSide: 'home', locked: true }),
  pickCardCase('Disabled - this viewer may not pick here', { disabled: true }),
  pickCardCase('Readonly - a results view; this pick was on the side that lost', {
    pickedSide: 'away',
    normalized: normalizedFinal({ away: GOLD, winnerSide: 'home' }),
    readonly: true,
  }),
];

@Component({
  selector: 'et-sb-bracket-pick-card-cases',
  template: `
    <div [style.max-inline-size.px]="420" class="grid gap-8 p-8 font-sans">
      @for (item of cases(); track item.title) {
        <div class="grid gap-2">
          <p class="text-small">{{ item.title }}</p>

          <div [style.block-size.px]="88">
            <et-bracket-pick-card
              [bracketMatch]="item.bracketMatch"
              [normalized]="item.normalized"
              [pickedSide]="item.pickedSide"
              [note]="item.note"
              [noteTone]="item.noteTone"
              [locked]="item.locked"
              [disabled]="item.disabled"
              [readonly]="item.readonly"
              [earlierRoundsClosed]="item.earlierRoundsClosed"
            />
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BracketPickCardComponent],
})
export class StorybookBracketPickCardCasesComponent {
  public cases = input.required<PickCardCase[]>();
}
