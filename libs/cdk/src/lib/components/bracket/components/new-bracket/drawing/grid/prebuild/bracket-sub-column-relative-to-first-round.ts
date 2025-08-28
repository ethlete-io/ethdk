import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../../core';
import { GenerateBracketGridDefinitionsOptions } from '../../../grid-definitions';
import { NewBracketRound } from '../../../linked';
import {
  BracketElementType,
  Span,
  createBracketElement,
  createBracketElementPart,
  createBracketSubColumn,
} from '../core';

export const createRoundBracketSubColumnRelativeToFirstRound = (config: {
  firstRound: NewBracketRound<any, any>;
  round: NewBracketRound<any, any>;
  span: Span;
  hasReverseFinal: boolean;
  options: GenerateBracketGridDefinitionsOptions;
}) => {
  const { firstRound, round, options, span, hasReverseFinal } = config;

  const { subColumn, pushElement } = createBracketSubColumn({
    span,
  });

  const matchFactor = firstRound.matchCount / round.matchCount;
  const matches = Array.from(round.matches.values());

  const elementsToCreate: Array<{
    type: BracketElementType;
    area: string;
    partHeights: number[];
    elementHeight: number;
  }> = [];

  // Only include a header row if headers exist
  if (options.roundHeaderHeight > 0) {
    elementsToCreate.push(
      {
        type: 'header',
        area: `h${round.shortId}`,
        partHeights: [options.roundHeaderHeight],
        elementHeight: options.roundHeaderHeight,
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
    const { element, pushPart } = createBracketElement({
      area: elementData.area,
      type: elementData.type,
      elementHeight: elementData.elementHeight,
    });

    for (const elementPartHeight of elementData.partHeights) {
      pushPart(
        createBracketElementPart({
          elementPartHeight,
        }).elementPart,
      );
    }

    pushElement(element);
  }

  return subColumn;
};
