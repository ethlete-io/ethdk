import { resolveBracketComponents } from './bracket-components';
import { createBracketGridConfig, resolveBracketLayoutSettings } from './bracket-grid';
import { BracketLayoutConfig } from './bracket.config';
import { MatchParticipantSide, SWISS_BRACKET_ROUND_TYPE, TOURNAMENT_MODE } from './core';
import { BracketDataSource } from './integrations';
import { swissBracketLayout } from './layouts';
import { createBracket, generateBracketRoundSwissGroupMaps } from './linked';

type SwissMatchInput = [id: string, home: string, away: string, winner: MatchParticipantSide | null];

const swissSource = (rounds: SwissMatchInput[][]): BracketDataSource<null, null> => ({
  mode: TOURNAMENT_MODE.SWISS_WITH_ELIMINATION,
  rounds: rounds.map((_, index) => ({
    id: `r${index}`,
    type: SWISS_BRACKET_ROUND_TYPE.SWISS,
    name: `Round ${index + 1}`,
    data: null,
  })),
  matches: rounds.flatMap((matches, index) =>
    matches.map(([id, home, away, winner]) => ({
      id,
      roundId: `r${index}`,
      home,
      away,
      winner,
      status: winner ? ('completed' as const) : ('pending' as const),
      data: null,
    })),
  ),
});

// a and c win round 1, a wins round 2 - so round 3 pairs the two 1-1 records and leaves the
// theoretically available 2-0 and 0-2 groups without a match.
const DECIDED_SWISS = swissSource([
  [
    ['r0-m0', 'a', 'b', 'home'],
    ['r0-m1', 'c', 'd', 'home'],
  ],
  [
    ['r1-m0', 'a', 'c', 'home'],
    ['r1-m1', 'b', 'd', 'home'],
  ],
  [['r2-m0', 'c', 'b', null]],
]);

const groupMaps = (source: BracketDataSource<null, null>) => {
  const groups = generateBracketRoundSwissGroupMaps(createBracket(source, { layout: 'left-to-right' }));

  if (!groups) throw new Error('not a swiss source');

  return Array.from(groups.values()).map((round) =>
    Object.fromEntries(Array.from(round.groups.values()).map((group) => [group.id, Array.from(group.matches.keys())])),
  );
};

const swissGrid = (source: BracketDataSource<null, null>, config: BracketLayoutConfig = {}) => {
  const layout = swissBracketLayout();
  const settings = resolveBracketLayoutSettings(config);

  return layout.createGrid(
    createBracket(source, { layout: layout.dataLayout }),
    createBracketGridConfig(settings, layout.dataLayout),
    resolveBracketComponents({}, {}, undefined),
  );
};

const drawSwiss = (source: BracketDataSource<null, null>, colors: Record<string, string>) => {
  const layout = swissBracketLayout();
  const settings = resolveBracketLayoutSettings({});

  return layout.drawEdges({ grid: swissGrid(source), settings, idPrefix: 'et-bracket-1', colors });
};

describe('swiss grouping', () => {
  it('groups a decided match by the record its participants brought into the round', () => {
    expect(groupMaps(DECIDED_SWISS)).toEqual([
      { '0-0': ['r0-m0', 'r0-m1'] },
      { '1-0': ['r1-m0'], '0-1': ['r1-m1'] },
      { '1-1': ['r2-m0'] },
    ]);
  });

  it('still fills the groups of a source whose matches carry no participants', () => {
    expect(
      groupMaps(
        swissSource([
          [
            ['r0-m0', '', '', null],
            ['r0-m1', '', '', null],
          ],
        ]),
      ),
    ).toEqual([{ '0-0': ['r0-m0', 'r0-m1'] }]);
  });
});

describe('the swiss grid', () => {
  it('draws the same matches with round headers on and off', () => {
    const matchesOf = (config: BracketLayoutConfig) =>
      swissGrid(DECIDED_SWISS, config)
        .columns.flatMap((column) => column.elements)
        .filter((element) => element.type === 'match')
        .map((element) => element.match.id);

    expect(matchesOf({})).toEqual(['r0-m0', 'r0-m1', 'r1-m0', 'r1-m1', 'r2-m0']);
    expect(matchesOf({ hideRoundHeaders: true })).toEqual(matchesOf({}));
  });

  it('heads every group it draws, so no header is left without a round', () => {
    const elements = swissGrid(DECIDED_SWISS).columns.flatMap((column) => column.elements);
    const headers = elements.filter((element) => element.type === 'header');

    expect(headers.map((header) => header.roundSwissGroup?.id)).toEqual(['0-0', '1-0', '0-1', '1-1']);
    expect(headers.every((header) => !!header.round)).toBe(true);
  });
});

describe('the swiss drawing', () => {
  it('escapes a color so it cannot inject an attribute of its own', () => {
    const svg = drawSwiss(DECIDED_SWISS, { neutral: '#fff" onload="alert(1)', positive: '#0f0' });

    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    host.innerHTML = svg;

    const rect = host.querySelector('rect');
    const stop = host.querySelector('stop');

    expect(rect?.getAttributeNames()).not.toContain('onload');
    expect(rect?.getAttribute('stroke')).toBe('#fff" onload="alert(1)');
    expect(stop?.getAttributeNames()).not.toContain('onload');
    expect(host.querySelectorAll('[onload]').length).toBe(0);
  });
});
