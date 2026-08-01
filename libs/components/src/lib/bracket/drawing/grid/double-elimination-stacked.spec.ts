import { resolveBracketComponents } from '../../bracket-components';
import { createBracketGridConfig, resolveBracketLayoutSettings } from '../../bracket-grid';
import { BRACKET_DATA_LAYOUT } from '../../core';
import { BracketDataSource } from '../../integrations';
import { createBracket } from '../../linked';
import { DoubleEliminationOptions, generateDoubleEliminationBracket } from '../../stories/generate-bracket';
import { createStackedDoubleEliminationGrid } from './double-elimination-stacked';

const WINNERS_SECTION = 0;
const BAND_SECTION = 1;
const LOSERS_SECTION = 2;

const settings = resolveBracketLayoutSettings({});

const build = (source: BracketDataSource<null, null>) => {
  const bracketData = createBracket(source, { layout: BRACKET_DATA_LAYOUT.MIRRORED });
  const grid = createStackedDoubleEliminationGrid(
    bracketData,
    createBracketGridConfig(settings, BRACKET_DATA_LAYOUT.MIRRORED),
    resolveBracketComponents({}, {}, undefined),
  );

  // Gap columns carry no rounds, so the round columns are every other master column.
  const masterColumns = grid.raw.grid.masterColumns.filter((_, index) => index % 2 === 0);

  return { grid, masterColumns, bracketData };
};

const stacked = (options: DoubleEliminationOptions) => build(generateDoubleEliminationBracket(options));

/** Every shape a double-elimination source comes in, from the generator's options. */
const SOURCE_SHAPES = [
  { participantCount: 8, includeFinal: true },
  { participantCount: 8, includeFinal: true, includeReverseFinal: false },
  { participantCount: 8, partial: true, includeFinal: true, includeThirdPlace: true },
  { participantCount: 8, includeFinal: false },
  { participantCount: 8, omitFirstUpperRound: true, includeFinal: false },
  { participantCount: 32, includeFinal: true },
  { participantCount: 32, partial: true, includeFinal: true, includeThirdPlace: true },
] satisfies DoubleEliminationOptions[];

/** Where the source's match `matchId` was drawn. */
const rectOf = (grid: ReturnType<typeof build>['grid'], matchId: string) => {
  const rect = grid.columns
    .flatMap((column) => column.elements)
    .find((element) => element.type === 'match' && element.match.id === matchId)?.dimensions;

  if (!rect) throw new Error(`${matchId} was not drawn`);

  return { ...rect, blockCentre: rect.top + rect.height / 2, inlineCentre: rect.left + rect.width / 2 };
};

describe('createStackedDoubleEliminationGrid', () => {
  it('gives each block an odd number of slots, so both centre on one master column', () => {
    const { masterColumns } = stacked({ participantCount: 32, includeFinal: true });

    // 32 teams: the winners bracket folds 4 rounds either side of its centre, the losers bracket 6.
    expect(masterColumns.length).toBe(13);
  });

  it('centres a shorter block inside the wider one rather than pinning it left', () => {
    // The winners bracket is 5 slots, the losers bracket 7 — so the winners block starts a column in.
    const { masterColumns } = stacked({
      participantCount: 8,
      partial: true,
      includeFinal: true,
      includeThirdPlace: true,
    });

    expect(masterColumns.length).toBe(7);

    const winnersHasRounds = masterColumns.map((column) =>
      (column.sections[WINNERS_SECTION]?.subColumns[0]?.elements ?? []).some((element) => element.type === 'match'),
    );

    expect(winnersHasRounds).toEqual([false, true, true, true, true, true, false]);
  });

  it('keeps the winners block the same height in every column, so the losers block stays level', () => {
    const { masterColumns } = stacked({ participantCount: 32, includeFinal: true });

    const winnersHeights = masterColumns.map((column) => column.sections[WINNERS_SECTION]?.dimensions.height);
    const losersTops = masterColumns.map((column) => column.sections[LOSERS_SECTION]?.dimensions.top);
    const bandHeights = masterColumns.map((column) => column.sections[BAND_SECTION]?.dimensions.height);

    expect(new Set(winnersHeights).size).toBe(1);
    expect(new Set(losersTops).size).toBe(1);
    expect(bandHeights.every((height) => height === settings.rowRoundGap)).toBe(true);
    expect(losersTops[0]).toBe((winnersHeights[0] ?? 0) + settings.rowRoundGap);
  });

  it('hangs the deciding rounds under the round the two halves converge on, in one column', () => {
    const { grid } = stacked({ participantCount: 32, includeFinal: true });

    const winnersFinal = rectOf(grid, 'ub-r4-m0');
    const grandFinal = rectOf(grid, 'final-m0');
    const bracketReset = rectOf(grid, 'reverse-final-m0');
    const losersFinal = rectOf(grid, 'lb-r7-m0');

    // One strip: the winners chain, the losers chain and the line between them all share an inline centre.
    const chain = [winnersFinal, grandFinal, bracketReset, losersFinal];

    expect(new Set(chain.map((rect) => rect.inlineCentre)).size).toBe(1);

    expect(grandFinal.top).toBeGreaterThan(winnersFinal.top + winnersFinal.height);
    expect(bracketReset.top).toBeGreaterThan(grandFinal.top + grandFinal.height);
    expect(losersFinal.top).toBeGreaterThan(bracketReset.top + bracketReset.height);
  });

  it('puts the round both halves converge on level with the halves feeding it', () => {
    // However long the chain under it is: an anchor off the block's centre turns both of those
    // connectors into diagonals, in a drawing where nothing else is.
    for (const options of [
      { participantCount: 32, includeFinal: false },
      { participantCount: 32, includeFinal: true },
    ] satisfies DoubleEliminationOptions[]) {
      const { grid } = stacked(options);

      // The last round before each block's centre is a 2-match round, so m0 is its left half and m1 its
      // right — the two the anchor is drawn between.
      const winnersAnchor = rectOf(grid, 'ub-r4-m0').blockCentre;
      const losersAnchor = rectOf(grid, 'lb-r6-m0').blockCentre;

      expect(rectOf(grid, 'ub-r3-m0').blockCentre).toBeCloseTo(winnersAnchor, 5);
      expect(rectOf(grid, 'ub-r3-m1').blockCentre).toBeCloseTo(winnersAnchor, 5);
      expect(rectOf(grid, 'lb-r5-m0').blockCentre).toBeCloseTo(losersAnchor, 5);
      expect(rectOf(grid, 'lb-r5-m1').blockCentre).toBeCloseTo(losersAnchor, 5);
    }
  });

  it('draws every match of the source exactly once, and never two on top of each other', () => {
    for (const options of SOURCE_SHAPES) {
      const { grid, bracketData } = stacked(options);

      const cells = grid.columns
        .flatMap((column) => column.elements)
        .filter((element) => element.type === 'match')
        .map((element) => ({ id: element.match.id, ...element.dimensions }));

      expect(cells.map((cell) => cell.id).sort()).toEqual([...bracketData.matches.keys()].sort());

      const overlapping = cells.flatMap((a, index) =>
        cells
          .slice(index + 1)
          .filter(
            (b) =>
              a.left < b.left + b.width &&
              b.left < a.left + a.width &&
              a.top < b.top + b.height &&
              b.top < a.top + a.height,
          )
          .map((b) => `${a.id} ∩ ${b.id}`),
      );

      expect(overlapping).toEqual([]);
    }
  });

  it('keeps every column inside its block, whatever hangs from the centre', () => {
    for (const options of SOURCE_SHAPES) {
      const { grid, masterColumns } = stacked(options);

      const winnersHeights = masterColumns.map((column) => column.sections[WINNERS_SECTION]?.dimensions.height);
      const losersHeights = masterColumns.map((column) => column.sections[LOSERS_SECTION]?.dimensions.height);

      expect(new Set(winnersHeights).size).toBe(1);
      expect(new Set(losersHeights).size).toBe(1);

      // The centre chain is the one column that can outgrow its rounds — `bottomPadding` is what stops it
      // spilling into the block below.
      const bottom = Math.max(
        ...grid.columns.flatMap((column) => column.elements).map((el) => el.dimensions.top + el.dimensions.height),
      );

      expect(bottom).toBeLessThanOrEqual(grid.raw.grid.dimensions.height);
    }
  });
});
