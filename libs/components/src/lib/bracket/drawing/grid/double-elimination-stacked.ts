import {
  BRACKET_ROUND_MIRROR_TYPE,
  BracketRoundType,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
} from '../../core';
import { Bracket, BracketRound } from '../../linked';
import {
  BracketComponents,
  BracketElementToCreate,
  createBracketElement,
  createBracketGrid,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
  finalizeBracketGrid,
} from './core';
import { createBracketGapMasterColumn, createRoundBracketSubColumnRelativeToFirstRound } from './prebuild';
import { ComputedBracketGrid, CreateBracketGridConfig } from './types';
import { RuntimeError } from '@ethlete/core';
import { BRACKET_ERROR_CODES } from '../../bracket-errors';

/**
 * Where a round that never folded sits in its block's centre chain. A bracket's own rounds go first, by
 * depth; the rounds that decide the tournament follow in the order they are played.
 */
const CENTRE_CHAIN_ORDER: Partial<Record<string, number>> = {
  [COMMON_BRACKET_ROUND_TYPE.FINAL]: 1,
  [DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL]: 2,
  [COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE]: 3,
};

/** One of the two blocks this layout stacks: a bracket folded around its own centre. */
type StackedBlock<TRoundData, TMatchData> = {
  /** Every other column's height is derived from this one — the outermost slot on the way out. */
  firstRound: BracketRound<TRoundData, TMatchData>;

  /** The slots left of the centre, outermost first. */
  left: BracketRound<TRoundData, TMatchData>[];

  /** The slots right of the centre, innermost first. */
  right: BracketRound<TRoundData, TMatchData>[];

  /**
   * The centre column, top to bottom: the round both halves converge on, then every round deeper than
   * it. Empty for a block truncated before its two halves meet.
   */
  chain: BracketRound<TRoundData, TMatchData>[];

  /** What one ordinary column's matches occupy, headers excluded. */
  content: number;

  /** What every ordinary column reserves below its matches so a chain taller than `content` fits. */
  bottomPadding: number;

  /** Where the chain starts, so its first round lands on the block's vertical centre. */
  spacerTop: number;

  spacerBottom: number;
};

type StackedBlockConfig<TRoundData, TMatchData> = {
  rounds: BracketRound<TRoundData, TMatchData>[];
  options: CreateBracketGridConfig;
  hasReverseFinal: boolean;
};

/** The card drawn for a round's matches — the deciding one is the taller `finalMatch`. */
const isFinalMatchRound = <TRoundData, TMatchData>(
  round: BracketRound<TRoundData, TMatchData>,
  hasReverseFinal: boolean,
) =>
  hasReverseFinal
    ? round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL
    : round.type === COMMON_BRACKET_ROUND_TYPE.FINAL;

/**
 * A chain round takes exactly the room its cards need. Every other column reserves the same height for
 * every round (`createRoundBracketSubColumnRelativeToFirstRound`), which the chain cannot do — it stacks
 * several rounds in one column.
 */
const chainRoundHeight = <TRoundData, TMatchData>(config: {
  round: BracketRound<TRoundData, TMatchData>;
  options: CreateBracketGridConfig;
  hasReverseFinal: boolean;
}) => {
  const { round, options, hasReverseFinal } = config;
  const cardHeight = isFinalMatchRound(round, hasReverseFinal) ? options.finalMatchHeight : options.matchHeight;

  return round.matchCount * cardHeight + Math.max(0, round.matchCount - 1) * options.rowGap;
};

/**
 * Splits one bracket's rounds into the fold's three parts and works out the heights that keep the two
 * blocks aligned. `null` when the bracket has no rounds at all.
 */
const createStackedBlock = <TRoundData, TMatchData>(
  config: StackedBlockConfig<TRoundData, TMatchData>,
): StackedBlock<TRoundData, TMatchData> | null => {
  const { rounds, options, hasReverseFinal } = config;

  const halves = rounds.filter((round) => !!round.mirrorRoundType);
  const left = halves
    .filter((round) => round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.LEFT)
    .sort((a, b) => a.logicalIndex - b.logicalIndex);
  const right = halves
    .filter((round) => round.mirrorRoundType === BRACKET_ROUND_MIRROR_TYPE.RIGHT)
    .sort((a, b) => b.logicalIndex - a.logicalIndex);

  const middles = rounds
    .filter((round) => !round.mirrorRoundType)
    .sort(
      (a, b) =>
        (CENTRE_CHAIN_ORDER[a.type] ?? 0) - (CENTRE_CHAIN_ORDER[b.type] ?? 0) || a.logicalIndex - b.logicalIndex,
    );

  // Where the two halves meet: one depth past the innermost round that had a second half to fold against.
  const foldDepth = left.length ? Math.max(...left.map((round) => round.logicalIndex)) + 1 : 0;

  // An odd early round could not halve, so it has no twin on the way back and keeps a slot of its own on
  // the way out rather than sitting in a middle it is far too wide for.
  const isEarly = (round: BracketRound<TRoundData, TMatchData>) =>
    !CENTRE_CHAIN_ORDER[round.type] && round.logicalIndex < foldDepth;

  const leftSlots = [...left, ...middles.filter(isEarly)].sort((a, b) => a.logicalIndex - b.logicalIndex);
  const chain = middles.filter((round) => !isEarly(round));

  const firstRound = leftSlots[0] ?? chain[0];

  if (!firstRound) return null;

  const content = firstRound.matchCount * options.matchHeight + Math.max(0, firstRound.matchCount - 1) * options.rowGap;

  let chainHeight = 0;

  for (const [index, round] of chain.entries()) {
    chainHeight += (index ? options.rowRoundGap : 0) + chainRoundHeight({ round, options, hasReverseFinal });
  }
  const anchorHeight = chain[0] ? chainRoundHeight({ round: chain[0], options, hasReverseFinal }) : 0;

  // The round both halves converge on sits on the block's vertical centre, which is where the two halves'
  // own matches sit — so the connectors into it stay straight. A chain too long to hang under it from
  // there grows the block rather than sliding up: an anchor a few px off centre turns every one of those
  // connectors into a diagonal, in a drawing where nothing else is.
  const spacerTop = Math.max(0, (content - anchorHeight) / 2);

  return {
    firstRound,
    left: leftSlots,
    right,
    chain,
    content,
    bottomPadding: Math.max(0, spacerTop + chainHeight - content),
    spacerTop,
    spacerBottom: Math.max(0, content - spacerTop - chainHeight),
  };
};

/**
 * Draws a double elimination as two mirrored blocks, one above the other: the winners bracket folded
 * around its own centre, the losers bracket folded around its own, and nothing but a gap between them.
 * Each block's deciding rounds hang vertically below the round its two halves converge on.
 *
 * @internal
 */
export const createStackedDoubleEliminationGrid = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
  options: CreateBracketGridConfig,
  components: BracketComponents<TRoundData, TMatchData>,
  // eslint-disable-next-line max-params -- grid builder signature (data, options, components)
): ComputedBracketGrid<TRoundData, TMatchData> => {
  const grid = createBracketGrid<TRoundData, TMatchData>({ spanElementWidth: options.columnWidth });

  const roundsOfType = (type: BracketRoundType) => Array.from(bracketData.roundsByType.get(type)?.values() ?? []);

  const hasReverseFinal = !!roundsOfType(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL).length;

  const winners = createStackedBlock({
    rounds: [
      ...roundsOfType(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET),
      ...roundsOfType(COMMON_BRACKET_ROUND_TYPE.FINAL),
      ...roundsOfType(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL),
    ],
    options,
    hasReverseFinal,
  });

  const losers = createStackedBlock({
    rounds: [
      ...roundsOfType(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET),
      ...roundsOfType(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE),
    ],
    options,
    hasReverseFinal,
  });

  if (!winners || !losers) {
    throw new RuntimeError(
      BRACKET_ERROR_CODES.ROUND_RELATION_INVALID,
      'No upper or lower rounds found in bracket data',
    );
  }

  const blocks = [winners, losers];
  const headerBlock = options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0;
  const blockHeight = (block: StackedBlock<TRoundData, TMatchData>) =>
    headerBlock + block.content + block.bottomPadding;

  // Both blocks put their centre in the same master column, so the chains — and the grand final's line
  // down to the losers champion — run up one strip rather than two.
  const centreIndex = Math.max(...blocks.map((block) => block.left.length));
  const columnCount = centreIndex + 1 + Math.max(...blocks.map((block) => block.right.length));

  /** A column this block does not reach into, holding the height its rounds would have taken. */
  const createPlaceholderSubColumn = (block: StackedBlock<TRoundData, TMatchData>) => {
    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
      span: { isStart: true, isEnd: true },
    });
    const height = blockHeight(block);

    pushElement(
      createBracketElement<TRoundData, TMatchData>({
        area: '.',
        type: 'colGap',
        elementHeight: height,
        partHeights: [height],
      }).element,
    );

    return subColumn;
  };

  const createChainSubColumn = (block: StackedBlock<TRoundData, TMatchData>) => {
    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
      span: { isStart: true, isEnd: true },
    });

    const anchor = block.chain[0];

    if (!anchor) return createPlaceholderSubColumn(block);

    const elementsToCreate: Array<BracketElementToCreate<TRoundData, TMatchData>> = [];

    // One header for the whole chain, naming the round its two halves converge on. The rounds below it
    // are a vertical run of single matches; a header between each would sit on the line joining them.
    if (options.roundHeaderHeight > 0) {
      elementsToCreate.push(
        {
          type: 'header',
          area: `h${anchor.shortId}`,
          partHeights: [options.roundHeaderHeight],
          elementHeight: options.roundHeaderHeight,
          component: components.roundHeader,
          round: anchor,
          roundSwissGroup: null,
        },
        {
          type: 'roundHeaderGap',
          area: '.',
          partHeights: [options.roundHeaderGap],
          elementHeight: options.roundHeaderGap,
        },
      );
    }

    if (block.spacerTop > 0) {
      elementsToCreate.push({
        type: 'colGap',
        area: '.',
        partHeights: [block.spacerTop],
        elementHeight: block.spacerTop,
      });
    }

    for (const [roundIndex, round] of block.chain.entries()) {
      if (roundIndex) {
        elementsToCreate.push({
          type: 'roundGap',
          area: '.',
          partHeights: [options.rowRoundGap],
          elementHeight: options.rowRoundGap,
        });
      }

      const isFinalCard = isFinalMatchRound(round, hasReverseFinal);
      const cardHeight = isFinalCard ? options.finalMatchHeight : options.matchHeight;

      for (const [matchIndex, match] of Array.from(round.matches.values()).entries()) {
        if (matchIndex) {
          elementsToCreate.push({
            type: 'matchGap',
            area: '.',
            partHeights: [options.rowGap],
            elementHeight: options.rowGap,
          });
        }

        elementsToCreate.push({
          type: 'match',
          area: `m${match.shortId}`,
          partHeights: [cardHeight],
          elementHeight: cardHeight,
          component: isFinalCard ? components.finalMatch : components.match,
          match,
          round,
          roundSwissGroup: null,
        });
      }
    }

    if (block.spacerBottom > 0) {
      elementsToCreate.push({
        type: 'colGap',
        area: '.',
        partHeights: [block.spacerBottom],
        elementHeight: block.spacerBottom,
      });
    }

    for (const elementData of elementsToCreate) {
      pushElement(createBracketElement<TRoundData, TMatchData>(elementData).element);
    }

    return subColumn;
  };

  /** What this block draws in the column at `columnIndex`, centred on the shared middle column. */
  const createBlockSubColumn = (block: StackedBlock<TRoundData, TMatchData>, columnIndex: number) => {
    const slotIndex = columnIndex - (centreIndex - block.left.length);

    if (slotIndex === block.left.length) return createChainSubColumn(block);

    const round =
      slotIndex >= 0 && slotIndex < block.left.length
        ? block.left[slotIndex]
        : block.right[slotIndex - block.left.length - 1];

    if (!round) return createPlaceholderSubColumn(block);

    return createRoundBracketSubColumnRelativeToFirstRound({
      firstRound: block.firstRound,
      round,
      options,
      hasReverseFinal,
      bottomPadding: block.bottomPadding,
      span: { isStart: true, isEnd: true },
      components,
    });
  };

  /** The band the print reference leaves empty: the two blocks are independent, so nothing crosses it. */
  const createBandSubColumn = () => {
    const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
      span: { isStart: true, isEnd: true },
    });

    pushElement(
      createBracketElement<TRoundData, TMatchData>({
        area: '.',
        type: 'roundGap',
        elementHeight: options.rowRoundGap,
        partHeights: [options.rowRoundGap],
      }).element,
    );

    return subColumn;
  };

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
      columnWidth: columnIndex === centreIndex ? options.finalColumnWidth : options.columnWidth,
      padding: { bottom: 0, left: 0, right: 0, top: 0 },
    });

    const winnersSection = createBracketMasterColumnSection<TRoundData, TMatchData>({ type: 'round' });
    const bandSection = createBracketMasterColumnSection<TRoundData, TMatchData>({ type: 'gap' });
    const losersSection = createBracketMasterColumnSection<TRoundData, TMatchData>({ type: 'round' });

    winnersSection.pushSubColumn(createBlockSubColumn(winners, columnIndex));
    bandSection.pushSubColumn(createBandSubColumn());
    losersSection.pushSubColumn(createBlockSubColumn(losers, columnIndex));

    pushSection(winnersSection.masterColumnSection, bandSection.masterColumnSection, losersSection.masterColumnSection);

    grid.pushMasterColumn(masterColumn);

    if (columnIndex < columnCount - 1) {
      grid.pushMasterColumn(
        createBracketGapMasterColumn({
          existingMasterColumns: grid.grid.masterColumns,
          columnGap: options.columnGap,
        }),
      );
    }
  }

  // No spans: a stacked block draws one round per column, so nothing reaches across its neighbours.
  grid.calculateDimensions();

  const finalizedGrid = finalizeBracketGrid(grid);

  return {
    raw: grid,
    columns: finalizedGrid.columns,
    matchElementMap: finalizedGrid.elementMap,
  };
};
