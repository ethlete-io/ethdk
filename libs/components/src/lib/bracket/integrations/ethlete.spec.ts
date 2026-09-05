import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import '../../../test-helpers';
import { queryAll } from '../../testing/driver-core';
import { BRACKET_ERROR_CODES } from '../bracket-errors';
import { TOURNAMENT_MODE } from '../core';
import { singleEliminationBracketLayout } from '../layouts';
import { bracketTestDriver } from '../testing/bracket-driver';
import { generateBracketDataForEthlete, generateTournamentModeFormEthleteRounds } from './ethlete';

type StubRound = {
  name: string;
  type: 'normal' | 'final';
  matchType?: 'single_elimination' | 'fifa_swiss';
  matchCount: number;
};

const stubStage = (rounds: StubRound[]) =>
  rounds.map(({ name, type, matchType, matchCount }) => ({
    round: { id: `round-${name}`, name, type },
    matches: Array.from({ length: matchCount }, (_, index) => ({
      id: `${name}-match-${index}`,
      matchType,
      status: 'published',
      winningSide: null,
      home: { id: `${name}-${index}-home` },
      away: { id: `${name}-${index}-away` },
    })),
  })) as unknown as RoundStageStructureWithMatchesView[];

describe('generateTournamentModeFormEthleteRounds', () => {
  it('reads the mode off the first drawn round, so a leading empty round is not fatal', () => {
    const stage = stubStage([
      { name: 'r1', type: 'normal', matchCount: 0 },
      { name: 'r2', type: 'normal', matchType: 'single_elimination', matchCount: 2 },
      { name: 'r3', type: 'final', matchType: 'single_elimination', matchCount: 1 },
    ]);

    expect(generateTournamentModeFormEthleteRounds(stage)).toBe(TOURNAMENT_MODE.SINGLE_ELIMINATION);
  });

  it('compares the swiss round sizes against the first drawn round', () => {
    const stage = stubStage([
      { name: 'r1', type: 'normal', matchCount: 0 },
      { name: 'r2', type: 'normal', matchType: 'fifa_swiss', matchCount: 4 },
      { name: 'r3', type: 'final', matchType: 'fifa_swiss', matchCount: 1 },
    ]);

    expect(generateTournamentModeFormEthleteRounds(stage)).toBe(TOURNAMENT_MODE.SWISS_WITH_ELIMINATION);
  });

  it('still rejects a stage without a single match', () => {
    expect(() =>
      generateTournamentModeFormEthleteRounds(stubStage([{ name: 'r1', type: 'normal', matchCount: 0 }])),
    ).toThrow(`ET${BRACKET_ERROR_CODES.SOURCE_EMPTY}`);

    expect(() => generateTournamentModeFormEthleteRounds([])).toThrow(`ET${BRACKET_ERROR_CODES.SOURCE_EMPTY}`);
  });
});

describe('generateBracketDataForEthlete', () => {
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
});
