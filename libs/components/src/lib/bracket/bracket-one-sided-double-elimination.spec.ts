import '../../test-helpers';
import { BracketRoundType } from '@ethlete/bracket';
import { queryAll } from '../testing/driver-core';
import { BRACKET_DEFAULT_CARDS } from './bracket-default-cards';
import { provideBracketConfig } from './bracket.config';
import { doubleEliminationBracketLayout, mirroredDoubleEliminationBracketLayout } from './layouts';
import { generateDoubleEliminationBracket } from './stories/generate-bracket';
import { bracketTestDriver } from './testing/bracket-driver';

const sourceOf = (types: BracketRoundType[]) => {
  const source = generateDoubleEliminationBracket({ participantCount: 8 });
  const rounds = source.rounds.filter((round) => types.includes(round.type));
  const roundIds = new Set(rounds.map((round) => round.id));

  return { ...source, rounds, matches: source.matches.filter((match) => roundIds.has(match.roundId)) };
};

describe('BracketComponent with a one-sided double elimination source', () => {
  it.each([
    ['the upper bracket', ['upper-bracket'], ['upper']],
    ['the lower bracket', ['lower-bracket'], ['lower']],
    ['the finals', ['final', 'reverse-final'], ['finals']],
  ] satisfies [string, BracketRoundType[], string[]][])(
    'draws every match of %s under its section title',
    (_, types, sections) => {
      const source = sourceOf(types);
      const driver = bracketTestDriver({
        source,
        layouts: [doubleEliminationBracketLayout()],
        providers: [provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, showSectionTitles: true })],
      });

      driver.detectChanges();

      expect(source.matches.length).toBeGreaterThan(0);
      expect(source.matches.filter((match) => !driver.cellFor(match.id))).toEqual([]);
      expect(
        queryAll(driver.fixture, '.et-bracket-section-title').map((title) => title.getAttribute('data-section')),
      ).toEqual(sections);
    },
  );

  it.each([['upper-bracket'], ['lower-bracket'], ['final', 'reverse-final']] satisfies BracketRoundType[][])(
    'draws a %s-only source in the mirrored layout',
    (...types) => {
      const source = sourceOf(types);
      const driver = bracketTestDriver({ source, layouts: [mirroredDoubleEliminationBracketLayout()] });

      driver.detectChanges();

      expect(source.matches.filter((match) => !driver.cellFor(match.id))).toEqual([]);
    },
  );
});
