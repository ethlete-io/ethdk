import { BRACKET_DATA_LAYOUT, BracketDataLayout, BracketRoundType } from '../../core';
import { createBracket } from '../../linked';
import { createPlaceholderBracketSource } from '../../placeholder-source';
import { drawMan } from '../draw-man';
import { BracketComponents } from './core';
import { createDoubleEliminationGrid } from './double-elimination';
import { createStackedDoubleEliminationGrid } from './double-elimination-stacked';
import { createSingleEliminationGrid } from './single-elimination';
import { BRACKET_FINAL_ALIGNMENT, ComputedBracketGrid, CreateBracketGridConfig } from './types';

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

const fullSource = createPlaceholderBracketSource({
  mode: 'double-elimination',
  participantCount: 8,
  includeReverseFinal: true,
});

const sourceOf = (types: BracketRoundType[]) => {
  const rounds = fullSource.rounds.filter((round) => types.includes(round.type));
  const roundIds = new Set(rounds.map((round) => round.id));

  return { ...fullSource, rounds, matches: fullSource.matches.filter((match) => roundIds.has(match.roundId)) };
};

const ONE_SIDED: [string, BracketRoundType[]][] = [
  ['the upper bracket', ['upper-bracket']],
  ['the lower bracket', ['lower-bracket']],
  ['the finals', ['final', 'reverse-final']],
  ['the upper bracket and the final', ['upper-bracket', 'final']],
];

const LAYOUTS = [
  { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT, createGrid: createDoubleEliminationGrid },
  { layout: BRACKET_DATA_LAYOUT.MIRRORED, createGrid: createStackedDoubleEliminationGrid },
];

const edgesOf = (grid: ComputedBracketGrid<null, null>) =>
  drawMan({
    columnWidth: 200,
    matchHeight: 80,
    roundHeaderHeight: 0,
    columnGap: 50,
    upperLowerGap: 0,
    rowGap: 10,
    path: { width: 1, dashArray: 0, dashOffset: 0 },
    curve: { lineStartingCurveAmount: 10, lineEndingCurveAmount: 10 },
    bracketGrid: grid,
  }).edges;

const placement = (grid: ComputedBracketGrid<null, null>) =>
  [...grid.matchElementMap.entries()].map(
    ([id, element]) => `${id} ${element.dimensions.left},${element.dimensions.top}`,
  );

describe('a double elimination source with one side', () => {
  describe.each(LAYOUTS)('$layout', ({ layout, createGrid }) => {
    it.each(ONE_SIDED)('places every match of %s and links each to the next', (_, types) => {
      const source = sourceOf(types);
      const bracket = createBracket(source, { layout });
      const grid = createGrid(bracket, config(layout), COMPONENTS);
      const edges = edgesOf(grid);
      const linkedMatches = new Set(edges.flatMap((edge) => edge.id.split('|')));

      expect([...grid.matchElementMap.keys()].sort()).toEqual(source.matches.map((match) => match.id).sort());
      expect(edges.length).toBeGreaterThan(0);
      expect(edges.every((edge) => !edge.d.includes('NaN'))).toBe(true);
      expect([...linkedMatches].sort()).toEqual(source.matches.map((match) => match.id).sort());
    });

    it.each(ONE_SIDED)('lays %s out as the single elimination tree it is', (_, types) => {
      const bracket = createBracket(sourceOf(types), { layout });

      expect(placement(createGrid(bracket, config(layout), COMPONENTS))).toEqual(
        placement(createSingleEliminationGrid(bracket, config(layout), COMPONENTS)),
      );
    });
  });

  it('reserves the title band above the side and its finals, and names each section', () => {
    const bracket = createBracket(sourceOf(['upper-bracket', 'final']), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const grid = createDoubleEliminationGrid(
      bracket,
      { ...config(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT), sectionTitleHeight: 40 },
      COMPONENTS,
    );

    expect(grid.matchElementMap.getOrThrow('ub-r0-m0').dimensions.top).toBe(40);
    expect(
      grid.sections?.map((section) => ({
        key: section.key,
        rounds: section.rounds.map((round) => round.id),
        title: section.titleDimensions,
      })),
    ).toEqual([
      { key: 'upper', rounds: ['ub-r0', 'ub-r1', 'ub-r2'], title: { top: 0, left: 0, width: 700, height: 40 } },
      { key: 'finals', rounds: ['final'], title: { top: 0, left: 750, width: 200, height: 40 } },
    ]);
  });

  it('reports the lower bracket section for a lower bracket on its own', () => {
    const bracket = createBracket(sourceOf(['lower-bracket']), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const grid = createDoubleEliminationGrid(bracket, config(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT), COMPONENTS);

    expect(grid.sections?.map((section) => section.key)).toEqual(['lower']);
  });

  it('ignores a centred final alignment, which needs both sides to centre between', () => {
    const bracket = createBracket(sourceOf(['upper-bracket', 'final']), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT });
    const options = config(BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT);
    const centred = createDoubleEliminationGrid(
      bracket,
      { ...options, finalAlignment: BRACKET_FINAL_ALIGNMENT.CENTER },
      COMPONENTS,
    );

    expect(placement(centred)).toEqual(placement(createDoubleEliminationGrid(bracket, options, COMPONENTS)));
    expect(centred.finalAlignment).toBeUndefined();
  });
});
