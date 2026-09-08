import { BracketRound } from '../../../linked';
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
  round: BracketRound<TRoundData, TMatchData>;
  /** How far below the top of the final's card the third place card sits, in px. */
  topOffset: number;
  options: CreateBracketGridConfig;
  components: BracketComponents<TRoundData, TMatchData>;
};

const heightOfElement = <TRoundData, TMatchData>(element: BracketElement<TRoundData, TMatchData>) =>
  element.parts.reduce((total, part) => total + part.dimensions.height, 0);

/** Read off the built rows rather than re-derived, so the two stay in step. */
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
 *
 * @internal
 */
export const createFoldedThirdPlaceSection = <TRoundData, TMatchData>(
  config: CreateFoldedThirdPlaceSectionConfig<TRoundData, TMatchData>,
): BracketMasterColumnSection<TRoundData, TMatchData> => {
  const { options, round } = config;
  const final = cardGeometry(config.finalSubColumn);
  const headerOffset = options.roundHeaderHeight > 0 ? options.roundHeaderHeight + options.roundHeaderGap : 0;

  // The section stacks below the final's, so what it has to make up is the offset less the room the
  // final's own section already takes. Negative when the fold lands inside that room, which is the
  // ordinary case: the final's block owns the rows of every round feeding it, so it is far taller
  // than its card.
  const paddingTop = final.cardTop + config.topOffset - final.height - headerOffset;

  const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
    type: 'round',
    padding: { top: paddingTop, bottom: 0, left: 0, right: 0 },
  });

  pushSubColumn(
    createRoundBracketSubColumnRelativeToFirstRound({
      firstRound: round,
      round,
      options,
      hasReverseFinal: false,
      // Placed by its offset, so it owns one row rather than the block a squeezed round would give it.
      matchFactor: 1,
      span: { isStart: true, isEnd: true },
      components: config.components,
    }),
  );

  return masterColumnSection;
};
