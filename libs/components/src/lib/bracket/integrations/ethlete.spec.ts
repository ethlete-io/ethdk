import { MatchListViewUnion, RoundStageStructureView, RoundStageStructureWithMatchesView } from '@ethlete/types';
import '../../../test-helpers';
import { EthleteMatchInput } from '../../match';
import { BracketMatchNormalizer } from '../bracket-card-context';
import { queryAll } from '../../testing/driver-core';
import { BRACKET_ERROR_CODES } from '../bracket-errors';
import {
  BracketRuntimeError,
  COMMON_BRACKET_ROUND_TYPE,
  SINGLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from '@ethlete/bracket';
import { singleEliminationBracketLayout } from '../layouts';
import { bracketTestDriver } from '../testing/bracket-driver';
import { BracketDataSource } from './base';
import {
  EthleteBracketMatchInput,
  EthleteRoundInput,
  EthleteRoundWithMatchesInput,
  generateBracketDataForEthlete,
  generateTournamentModeFromEthleteRounds,
  normalizeEthleteBracketMatch,
} from './ethlete';

type StubRound = {
  name: string;
  type: 'normal' | 'final';
  matchType?: 'single_elimination' | 'fifa_swiss';
  matchCount: number;
};

const stubStage = (rounds: StubRound[]): EthleteRoundWithMatchesInput[] =>
  rounds.map(({ name, type, matchType, matchCount }) => ({
    round: { id: `round-${name}`, name, type },
    matches: Array.from({ length: matchCount }, (_, index) => ({
      id: `${name}-match-${index}`,
      matchType: matchType ?? null,
      status: 'published',
      winningSide: null,
      home: { id: `${name}-${index}-home` },
      away: { id: `${name}-${index}-away` },
    })),
  }));

type SponsoredRound = EthleteRoundInput & { sponsor: string };
type StreamedMatch = EthleteBracketMatchInput & { streamUrl: string | null };

describe('input types', () => {
  it('accept the generated @ethlete/types models and keep them as the bracket data', () => {
    const fromGenerated = (source: RoundStageStructureWithMatchesView[]) => generateBracketDataForEthlete(source);

    expectTypeOf(fromGenerated).returns.toEqualTypeOf<BracketDataSource<RoundStageStructureView, MatchListViewUnion>>();
    expectTypeOf(normalizeEthleteBracketMatch).toExtend<
      BracketMatchNormalizer<RoundStageStructureView, MatchListViewUnion>
    >();
  });

  it('keep the fields of an extended model in the bracket data', () => {
    const source: EthleteRoundWithMatchesInput<SponsoredRound, StreamedMatch>[] = [
      {
        round: { id: 'final', name: 'Final', type: 'final', sponsor: 'ACME' },
        matches: [
          {
            id: 'final-match',
            matchType: 'single_elimination',
            status: 'published',
            winningSide: 'home',
            home: { id: 'home' },
            away: { id: 'away' },
            streamUrl: 'https://example.com/stream',
          },
        ],
      },
    ];

    const data = generateBracketDataForEthlete(source);

    expectTypeOf(data).toEqualTypeOf<BracketDataSource<SponsoredRound, StreamedMatch>>();
    expect(data.rounds[0]?.data.sponsor).toBe('ACME');
    expect(data.matches[0]?.data.streamUrl).toBe('https://example.com/stream');
  });

  it('let the normalizer read an extended match model', () => {
    expectTypeOf(normalizeEthleteBracketMatch).toExtend<
      BracketMatchNormalizer<SponsoredRound, EthleteMatchInput & { streamUrl: string | null }>
    >();
  });

  it('let the normalizer read a model without matchNumber and matchGameNumber', () => {
    type OlderMatch = Omit<EthleteMatchInput, 'matchNumber' | 'games'> & {
      games: { homeScore: { score: number | null } | null; awayScore: { score: number | null } | null }[];
    };

    expectTypeOf(normalizeEthleteBracketMatch).toExtend<BracketMatchNormalizer<SponsoredRound, OlderMatch>>();
  });
});

describe('generateTournamentModeFromEthleteRounds', () => {
  it('reads the mode off the first drawn round, so a leading empty round is not fatal', () => {
    const stage = stubStage([
      { name: 'r1', type: 'normal', matchCount: 0 },
      { name: 'r2', type: 'normal', matchType: 'single_elimination', matchCount: 2 },
      { name: 'r3', type: 'final', matchType: 'single_elimination', matchCount: 1 },
    ]);

    expect(generateTournamentModeFromEthleteRounds(stage)).toBe(TOURNAMENT_MODE.SINGLE_ELIMINATION);
  });

  it('reads a swiss stage off its stage type, even while every listed round has the same size', () => {
    const stage = stubStage([
      { name: 'r1', type: 'normal', matchType: 'fifa_swiss', matchCount: 8 },
      { name: 'r2', type: 'normal', matchType: 'fifa_swiss', matchCount: 8 },
      { name: 'r3', type: 'normal', matchType: 'fifa_swiss', matchCount: 8 },
    ]);

    expect(generateTournamentModeFromEthleteRounds(stage)).toBe(TOURNAMENT_MODE.SWISS_WITH_ELIMINATION);
  });

  it('reads a stage without matches off its round types', () => {
    expect(generateTournamentModeFromEthleteRounds(stubStage([{ name: 'r1', type: 'normal', matchCount: 0 }]))).toBe(
      TOURNAMENT_MODE.SINGLE_ELIMINATION,
    );

    expect(
      generateTournamentModeFromEthleteRounds([
        { round: { id: 'wb', name: 'WB', type: 'winner_bracket' }, matches: [] },
        { round: { id: 'lb', name: 'LB', type: 'loser_bracket' }, matches: [] },
        { round: { id: 'f', name: 'Final', type: 'final' }, matches: [] },
      ]),
    ).toBe(TOURNAMENT_MODE.DOUBLE_ELIMINATION);
  });

  it('lets the mode option win over the matches and round types', () => {
    const stage = stubStage([{ name: 'r1', type: 'normal', matchType: 'single_elimination', matchCount: 2 }]);

    expect(generateTournamentModeFromEthleteRounds(stage, { mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION })).toBe(
      TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
    );
  });

  it('rejects a stage without rounds with a BracketRuntimeError that names the skeleton', () => {
    let error: unknown;

    try {
      generateTournamentModeFromEthleteRounds([]);
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(BracketRuntimeError);
    expect((error as BracketRuntimeError).code).toBe(BRACKET_ERROR_CODES.SOURCE_EMPTY);
    expect((error as BracketRuntimeError).message).toContain('et-bracket-skeleton');
  });
});

describe('generateBracketDataForEthlete', () => {
  it('types a one-match normal round as the final only when it is the last round', () => {
    const source = generateBracketDataForEthlete(
      stubStage([
        { name: 'playIn', type: 'normal', matchType: 'single_elimination', matchCount: 1 },
        { name: 'semi', type: 'normal', matchType: 'single_elimination', matchCount: 2 },
        { name: 'final', type: 'normal', matchType: 'single_elimination', matchCount: 1 },
      ]),
    );

    expect(source.rounds.map((round) => round.type)).toEqual([
      SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      COMMON_BRACKET_ROUND_TYPE.FINAL,
    ]);
  });

  it('keeps the last normal round the final when a third place round is listed after it', () => {
    const source = generateBracketDataForEthlete([
      ...stubStage([
        { name: 'semi', type: 'normal', matchType: 'single_elimination', matchCount: 2 },
        { name: 'final', type: 'normal', matchType: 'single_elimination', matchCount: 1 },
      ]),
      { round: { id: 'round-third', name: 'third', type: 'third_place' }, matches: [] },
    ]);

    expect(source.rounds.map((round) => round.type)).toEqual([
      SINGLE_ELIMINATION_BRACKET_ROUND_TYPE.SINGLE_ELIMINATION_BRACKET,
      COMMON_BRACKET_ROUND_TYPE.FINAL,
      COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE,
    ]);
  });

  it('keeps a leading empty round in the source and draws the stage', () => {
    const source = generateBracketDataForEthlete(
      stubStage([
        { name: 'r1', type: 'normal', matchCount: 0 },
        { name: 'r2', type: 'normal', matchType: 'single_elimination', matchCount: 2 },
        { name: 'r3', type: 'final', matchType: 'single_elimination', matchCount: 1 },
      ]),
    );

    expect(source.rounds.map((round) => round.id)).toEqual(['round-r1', 'round-r2', 'round-r3']);
    expect(source.matches).toHaveLength(3);

    const driver = bracketTestDriver({ source, layouts: [singleEliminationBracketLayout()] });

    expect(queryAll(driver.fixture, '.et-bracket-element--match').length).toBe(3);
  });

  it('draws a stage published with its rounds but no matches yet', () => {
    const source = generateBracketDataForEthlete(
      stubStage([
        { name: 'r1', type: 'normal', matchCount: 0 },
        { name: 'r2', type: 'normal', matchCount: 0 },
        { name: 'r3', type: 'final', matchCount: 0 },
      ]),
    );

    expect(source.mode).toBe(TOURNAMENT_MODE.SINGLE_ELIMINATION);
    expect(source.matches).toHaveLength(0);

    const driver = bracketTestDriver({ source, layouts: [singleEliminationBracketLayout()] });

    expect(driver.element()).toBeTruthy();
    expect(queryAll(driver.fixture, '.et-bracket-element--match').length).toBe(0);
  });

  it('reads a finished but unpublished match as completed, as the match normalizer does', () => {
    const statuses = ['finished', 'published', 'started'] as const;
    const stage = stubStage([{ name: 'r1', type: 'final', matchType: 'single_elimination', matchCount: 3 }]).map(
      ({ round, matches }) => ({
        round,
        matches: matches.map((match, index) => ({ ...match, status: statuses[index] ?? null })),
      }),
    );
    const source = generateBracketDataForEthlete(stage);

    expect(source.matches.map((match) => match.status)).toEqual(['completed', 'completed', 'pending']);
  });
});
