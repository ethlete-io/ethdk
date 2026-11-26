import { NewBracketRound } from '../../../linked';
import {
  BracketComponents,
  BracketElement,
  BracketMasterColumnSection,
  BracketSubColumn,
  createBracketMasterColumnSection,
} from '../core';
import { CreateBracketGridConfig } from '../types';
import { createRoundBracketSubColumnRelativeToFirstRound } from './bracket-sub-column-relative-to-first-round';

export type CreateFoldedThirdPlaceSectionConfig<TRoundData, TMatchData> = {
  /** The sub column holding the final, which the folded round is placed relative to. */
  finalSubColumn: BracketSubColumn<TRoundData, TMatchData>;
  round: NewBracketRound<TRoundData, TMatchData>;
  /** How far below the top of the final's card the third place card sits, in px. */
  topOffset: number;
  options: CreateBracketGridConfig;
  components: BracketComponents<TRoundData, TMatchData>;
};

const heightOfElement = <TRoundData, TMatchData>(element: BracketElement<TRoundData, TMatchData>) =>
  element.parts.reduce((total, part) => total + part.dimensions.height, 0);

const cardGeometry = <TRoundData, TMatchData>(subColumn: BracketSubColumn<TRoundData, TMatchData>) => {
  let height = 0;
  let cardTop: number | null = null;

  for (const element of subColumn.elements) {
    const elementHeight = heightOfElement(element);

    if (element.type === 'match' && cardTop === null) {
      cardTop = height + (elementHeight - element.dimensions.height) / 2;
    }

    height += elementHeight;
  }

  return { cardTop: cardTop ?? 0, height };
};

/**
 * The third place match as a second section of the final's master column: one card the given number of
 * px below the top of the final's, with its own round header above it.
 */
export const createFoldedThirdPlaceSection = <TRoundData, TMatchData>(
  config: CreateFoldedThirdPlaceSectionConfig<TRoundData, TMatchData>,
): BracketMasterColumnSection<TRoundData, TMatchData> => {
  const { options, round } = config;
  const final = cardGeometry(config.finalSubColumn);
  const headerOffset = options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0;

  // The section stacks below the final's, so it only has to make up the offset less the room the final's
  // own section already takes. This is negative in the ordinary case: the final's block owns the rows of
  // every round that feeds it, so it is far taller than its card.
  const paddingTop = final.cardTop + config.topOffset - final.height - headerOffset;

  const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
    type: 'round',
    padding: { top: paddingTop, bottom: 0, left: 0, right: 0 },
  });

  pushSubColumn(
    createRoundBracketSubColumnRelativeToFirstRound({
      // Relative to itself, so the card owns one row instead of the block of the first round.
      firstRound: round,
      round,
      options,
      hasReverseFinal: false,
      span: { isStart: true, isEnd: true },
      components: config.components,
    }),
  );

  return masterColumnSection;
};
