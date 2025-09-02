import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../../core';
import { NewBracketRound } from '../../../linked';
import {
  BracketComponents,
  BracketElementToCreate,
  BracketSubColumnSpan,
  createBracketElement,
  createBracketSubColumn,
} from '../core';
import { CreateBracketGridConfig } from '../types';

export type CreateRoundBracketSubColumnRelativeToFirstRoundConfig<TRoundData, TMatchData> = {
  firstRound: NewBracketRound<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
  span: BracketSubColumnSpan;
  hasReverseFinal: boolean;
  options: CreateBracketGridConfig;
  components: BracketComponents<TRoundData, TMatchData>;
};

export const createRoundBracketSubColumnRelativeToFirstRound = <TRoundData, TMatchData>(
  config: CreateRoundBracketSubColumnRelativeToFirstRoundConfig<TRoundData, TMatchData>,
) => {
  const { firstRound, round, options, span, hasReverseFinal } = config;

  const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
    span,
  });

  const matchFactor = firstRound.matchCount / round.matchCount;
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
      },
      {
        type: 'roundHeaderGap',
        area: '.',
        partHeights: [options.rowGap],
        elementHeight: options.rowGap,
      },
    );
  }

  // Add match elements to create
  for (const [matchIndex, match] of matches.entries()) {
    const isLastMatch = matchIndex === matches.length - 1;

    const matchRows: number[] = [];
    for (let factorIndex = 0; factorIndex < matchFactor; factorIndex++) {
      const isLastFactor = factorIndex === matchFactor - 1;

      // Add the match height
      matchRows.push(options.matchHeight);

      if (isLastFactor) continue;

      // Add gap between match factors (except after the last one)
      matchRows.push(options.rowGap);
    }

    const isFinalMatch = hasReverseFinal
      ? round.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL
      : round.type === COMMON_BRACKET_ROUND_TYPE.FINAL;

    elementsToCreate.push({
      type: 'match',
      area: `m${match.shortId}`,
      partHeights: matchRows,
      elementHeight: isFinalMatch ? options.finalMatchHeight : options.matchHeight,
      component: isFinalMatch ? config.components.finalMatch : config.components.match,
      match,
      round,
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

  // Create all elements at once
  for (const elementData of elementsToCreate) {
    const { element } = createBracketElement(elementData);

    pushElement(element);
  }

  return subColumn;
};
