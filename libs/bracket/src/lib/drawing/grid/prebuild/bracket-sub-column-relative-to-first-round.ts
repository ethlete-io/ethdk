import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../../core';
import { BracketRound } from '../../../linked';
import {
  BracketComponents,
  BracketElementToCreate,
  BracketSubColumnSpan,
  createBracketElement,
  createBracketSubColumn,
} from '../core';
import { CreateBracketGridConfig } from '../types';

export type CreateRoundBracketSubColumnRelativeToFirstRoundConfig<TRoundData, TMatchData> = {
  firstRound: BracketRound<TRoundData, TMatchData>;
  round: BracketRound<TRoundData, TMatchData>;
  span: BracketSubColumnSpan;
  hasReverseFinal: boolean;
  options: CreateBracketGridConfig;
  components: BracketComponents<TRoundData, TMatchData>;

  /**
   * Reserved space below the last match, for a layout whose columns are taller than the first round
   * needs - a stacked bracket's centre chain hanging past the bottom of its block.
   */
  bottomPadding?: number;
};

export const createRoundBracketSubColumnRelativeToFirstRound = <TRoundData, TMatchData>(
  config: CreateRoundBracketSubColumnRelativeToFirstRoundConfig<TRoundData, TMatchData>,
) => {
  const { firstRound, round, options, span, hasReverseFinal } = config;

  const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
    span,
  });

  const matchFactor = Math.max(1, (options.rowSpanMatchCount ?? firstRound.matchCount) / round.matchCount);
  const matches = Array.from(round.matches.values());

  const elementsToCreate: Array<BracketElementToCreate<TRoundData, TMatchData>> = [];

  // Only include a header row if headers exist
  if (options.roundHeaderHeight > 0) {
    elementsToCreate.push(
      {
        type: 'header',
        area: `h${round.shortId}`,
        partHeights: [options.roundHeaderHeight],
        elementHeight: options.roundHeaderHeight,
        component: config.components.roundHeader,
        round,
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

  // Add match elements to create
  for (const [matchIndex, match] of matches.entries()) {
    const isLastMatch = matchIndex === matches.length - 1;

    // One row per match this one is fed by. A fractional factor has no whole feeder row to align to,
    // so floor it and let the block padding below absorb the remainder - rounding up instead emits a
    // row the block height cannot pay for, and the padding turns negative to compensate.
    const fedMatchCount = Math.floor(matchFactor);
    const matchRows: number[] = [];

    for (let factorIndex = 0; factorIndex < fedMatchCount; factorIndex++) {
      matchRows.push(options.matchHeight);

      if (factorIndex < fedMatchCount - 1) matchRows.push(options.rowGap);
    }

    const isFinalMatch = hasReverseFinal
      ? round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL
      : round.type === COMMON_BRACKET_ROUND_TYPE.FINAL;
    const elementHeight = isFinalMatch ? options.finalMatchHeight : options.matchHeight;
    const blockHeight = Math.max(elementHeight, matchFactor * options.matchHeight + (matchFactor - 1) * options.rowGap);
    const currentBlockHeight = matchRows.reduce((total, height) => total + height, 0);

    matchRows[matchRows.length - 1] = (matchRows[matchRows.length - 1] ?? 0) + blockHeight - currentBlockHeight;

    elementsToCreate.push({
      type: 'match',
      area: `m${match.shortId}`,
      partHeights: matchRows,
      elementHeight,
      component: isFinalMatch ? config.components.finalMatch : config.components.match,
      match,
      round,
      roundSwissGroup: null,
    });

    if (!isLastMatch) {
      elementsToCreate.push({
        type: 'matchGap',
        area: '.',
        partHeights: [options.rowGap],
        elementHeight: options.rowGap,
      });
    }
  }

  if (config.bottomPadding) {
    elementsToCreate.push({
      type: 'colGap',
      area: '.',
      partHeights: [config.bottomPadding],
      elementHeight: config.bottomPadding,
    });
  }

  // Create all elements at once
  for (const elementData of elementsToCreate) {
    const { element } = createBracketElement(elementData);

    pushElement(element);
  }

  return subColumn;
};
