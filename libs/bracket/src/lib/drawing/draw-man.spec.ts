import { BRACKET_DATA_LAYOUT, BracketDataLayout } from '../core';
import { BracketDataSource, bracketSlot } from '../integrations';
import { createBracket } from '../linked';
import { drawMan } from './draw-man';
import { BracketComponents } from './grid/core';
import { createDoubleEliminationGrid } from './grid/double-elimination';
import { createStackedDoubleEliminationGrid } from './grid/double-elimination-stacked';
import { createSingleEliminationGrid } from './grid/single-elimination';
import { CreateBracketGridConfig } from './grid/types';

const config = (layout: BracketDataLayout): CreateBracketGridConfig => ({
  includeRoundHeaders: false,
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 0,
  roundHeaderGap: 0,
  columnGap: 50,
  rowRoundGap: 0,
  rowGap: 10,
  rowSpanRoundId: null,
  finalMatchHeight: 80,
  finalColumnWidth: 200,
  swissGroupPadding: 0,
  swissGroupBorderWidth: 0,
  layout,
});

const COMPONENTS = {
  roundHeader: class {},
  match: class {},
  finalMatch: class {},
} as unknown as BracketComponents<null, null>;

const round = (id: string, type: 'upper-bracket' | 'lower-bracket' | 'final') => ({ id, name: id, type, data: null });

const match = (id: string, roundId: string, home: string | null, away: string | null, winner: 'home' | null) => ({
  id,
  roundId,
  home,
  away,
  winner,
  status: winner ? ('completed' as const) : ('pending' as const),
  data: null,
});

const eightTeams: BracketDataSource<null, null> = {
  mode: 'double-elimination',
  rounds: [
    round('u1', 'upper-bracket'),
    round('u2', 'upper-bracket'),
    round('u3', 'upper-bracket'),
    round('l1', 'lower-bracket'),
    round('l2', 'lower-bracket'),
    round('l3', 'lower-bracket'),
    round('l4', 'lower-bracket'),
    round('gf', 'final'),
  ],
  matches: [
    match('u1a', 'u1', 'a', 'b', 'home'),
    match('u1b', 'u1', 'c', 'd', 'home'),
    match('u1c', 'u1', 'e', 'f', 'home'),
    match('u1d', 'u1', 'g', 'h', 'home'),
    match('u2a', 'u2', 'a', 'c', 'home'),
    match('u2b', 'u2', 'e', 'g', 'home'),
    match('u3a', 'u3', 'a', 'e', 'home'),
    match('l1a', 'l1', 'b', 'd', 'home'),
    match('l1b', 'l1', 'f', 'h', 'home'),
    match('l2a', 'l2', 'c', 'g', 'home'),
    match('l2b', 'l2', 'a', 'e', 'home'),
    match('l3a', 'l3', 'b', 'c', 'home'),
    match('l4a', 'l4', 'e', 'b', 'home'),
    match('gfa', 'gf', 'a', 'b', null),
  ],
};

const DRAW_OPTIONS = {
  columnWidth: 200,
  matchHeight: 80,
  roundHeaderHeight: 0,
  columnGap: 50,
  upperLowerGap: 30,
  rowGap: 10,
  path: { width: 1, dashArray: 0, dashOffset: 0 },
  curve: { lineStartingCurveAmount: 10, lineEndingCurveAmount: 10 },
  continuePath: { width: 1, dashArray: 4, dashOffset: 0 },
};

const drawDoubleElimination = (layout: BracketDataLayout, stacked = false) => {
  const bracket = createBracket(eightTeams, { layout });
  const build = stacked ? createStackedDoubleEliminationGrid : createDoubleEliminationGrid;

  return drawMan({ ...DRAW_OPTIONS, bracketGrid: build(bracket, config(layout), COMPONENTS) });
};

const summary = (edges: ReturnType<typeof drawMan>['edges']) => edges.map((edge) => `${edge.id} [${edge.cssClass}]`);

describe('drawMan', () => {
  it('draws every connector of a double elimination, each carrying the winner it comes from', () => {
    expect(summary(drawDoubleElimination(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT).edges)).toEqual([
      'u1a|u2a [p26]',
      'u1b|u2a [p23]',
      'u1c|u2b [p24]',
      'u1d|u2b [p19]',
      'l1a|l2a [p27]',
      'l1b|l2b [p16]',
      'l2a|l3a [p23]',
      'l2b|l3a [p26]',
      'u2a|u3a [p26]',
      'u2b|u3a [p24]',
      'l3a|l4a [p27]',
      'u3a|gfa [p26 p27]',
      'l4a|gfa [p24]',
    ]);
  });

  it('feeds the losers champion into the grand final along a curve that ends on it', () => {
    const edge = drawDoubleElimination(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT).edges.find((e) => e.id === 'l4a|gfa');

    expect(edge?.d).toBe('M 950 435 H 965 Q 975 435, 975 425 V 185 Q 975 175, 985 175 H 1000');
  });

  it('draws the way back of a mirrored double elimination from right to left, plus the lines across the middle', () => {
    const drawing = drawDoubleElimination(BRACKET_DATA_LAYOUT.MIRRORED);

    expect(summary(drawing.edges)).toEqual([
      'u1a|u2a [p26]',
      'u1b|u2a [p23]',
      'l1a|l2a [p27]',
      'l2a|l3a [p23]',
      'u2a|u3a [p26]',
      'l3a|l4a [p27]',
      'u3a|u2b [p24]',
      'u1c|u2b [p24]',
      'u1d|u2b [p19]',
      'l3a|l2b [p26]',
      'l1b|l2b [p16]',
      'u3a|gfa [p26 p27]',
      'l4a|gfa [p24]',
    ]);
    expect(drawing.edges.find((e) => e.id === 'u1c|u2b')?.d).toBe(
      'M 1250 40 H 1235 Q 1225 40, 1225 50 V 75 Q 1225 85, 1215 85 H 1200',
    );
  });

  it('runs the losers champion of a stacked double elimination up a dashed gutter past the cards under it', () => {
    const drawing = drawDoubleElimination(BRACKET_DATA_LAYOUT.MIRRORED, true);
    const gutter = drawing.edges.find((e) => e.id === 'l4a|gfa');

    expect(gutter?.d).toBe('M 700 325 H 725 V 165 H 700');
    expect(gutter?.dashArray).toBe(4);
    expect(drawing.edges.find((e) => e.id === 'u3a|gfa')?.d).toBe('M 600 125 V 125');
  });

  it('bends a merge arm towards its card when the source names the lower feeder first', () => {
    const source: BracketDataSource<null, null> = {
      mode: 'single-elimination',
      rounds: [
        { id: 'r0', name: 'r0', type: 'single-elimination-bracket', data: null },
        { id: 'f', name: 'f', type: 'final', data: null },
      ],
      matches: [
        match('a', 'r0', 'p1', 'p2', null),
        match('b', 'r0', 'p3', 'p4', null),
        {
          ...match('fm', 'f', null, null, null),
          homeSource: bracketSlot.matchOutcome('b', 'winner'),
          awaySource: bracketSlot.matchOutcome('a', 'winner'),
        },
      ],
    };
    const layout = BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
    const grid = createSingleEliminationGrid(createBracket(source, { layout }), config(layout), COMPONENTS);
    const blockCoordinates = (d: string) =>
      [...d.matchAll(/(?:M|Q) [\d.-]+ ([\d.-]+)|, [\d.-]+ ([\d.-]+)|V ([\d.-]+)/g)].map((found) =>
        Number(found[1] ?? found[2] ?? found[3]),
      );

    for (const edge of drawMan({ ...DRAW_OPTIONS, bracketGrid: grid }).edges) {
      const [from, ...rest] = blockCoordinates(edge.d);
      const to = rest.at(-1);

      expect(from).toBeDefined();
      expect(to).toBeDefined();

      const low = Math.min(from ?? 0, to ?? 0);
      const high = Math.max(from ?? 0, to ?? 0);

      expect(blockCoordinates(edge.d).every((y) => y >= low && y <= high)).toBe(true);
    }
  });
});
