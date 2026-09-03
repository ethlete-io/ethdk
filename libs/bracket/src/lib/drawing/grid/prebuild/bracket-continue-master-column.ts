import { COMMON_BRACKET_ROUND_TYPE } from '../../../core';
import { Bracket, BracketMatch } from '../../../linked';
import {
  BracketContinueComponent,
  BracketMasterColumn,
  createBracketElement,
  createBracketMasterColumn,
  createBracketMasterColumnSection,
  createBracketSubColumn,
} from '../core';
import { BracketRuntimeError } from '../../../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../../../bracket-errors';

export const isBracketContinueMatch = <TRoundData, TMatchData>(match: BracketMatch<TRoundData, TMatchData>) =>
  match.round.type !== COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE &&
  (match.relation.type === 'one-to-nothing' || match.relation.type === 'two-to-nothing');

export const getBracketContinueMatches = <TRoundData, TMatchData>(
  bracketData: Bracket<TRoundData, TMatchData>,
): BracketMatch<TRoundData, TMatchData>[] =>
  Array.from(bracketData.matches.values()).filter((match) => isBracketContinueMatch(match));

export type CreateBracketContinueMasterColumnConfig<TRoundData, TMatchData> = {
  existingMasterColumns: ReadonlyArray<BracketMasterColumn<TRoundData, TMatchData>>;
  columnWidth: number;
  elementHeight: number;

  /** Vertical space taken by the round header block (header + gap). 0 if headers are hidden. */
  headerOffset: number;
  component: BracketContinueComponent<TRoundData, TMatchData>;
  matches: BracketMatch<TRoundData, TMatchData>[];
};

export const createBracketContinueMasterColumn = <TRoundData, TMatchData>(
  config: CreateBracketContinueMasterColumnConfig<TRoundData, TMatchData>,
) => {
  const { existingMasterColumns, columnWidth, elementHeight, headerOffset, component, matches } = config;

  const lastMasterColumn = existingMasterColumns[existingMasterColumns.length - 1];

  if (!lastMasterColumn) {
    throw new BracketRuntimeError(
      BRACKET_ERROR_CODES.GRID_INVALID,
      'No last master column found in existing master columns',
    );
  }

  // Dimensions are not calculated yet at this point, but all part heights are static, so the
  // total column height is the sum of the tallest sub column of every section.
  const totalHeight = lastMasterColumn.sections.reduce((height, section) => {
    const sectionHeight = Math.max(
      0,
      ...section.subColumns.map((subColumn) =>
        subColumn.elements.reduce(
          (subColumnHeight, element) =>
            subColumnHeight + element.parts.reduce((sum, part) => sum + part.dimensions.height, 0),
          0,
        ),
      ),
    );

    return height + sectionHeight;
  }, 0);

  const { masterColumn, pushSection } = createBracketMasterColumn<TRoundData, TMatchData>({
    columnWidth,
    padding: {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    },
  });

  const { masterColumnSection, pushSubColumn } = createBracketMasterColumnSection<TRoundData, TMatchData>({
    type: 'round',
  });

  const { subColumn, pushElement } = createBracketSubColumn<TRoundData, TMatchData>({
    span: {
      isStart: true,
      isEnd: true,
    },
  });

  if (headerOffset > 0) {
    const { element: headerGapElement } = createBracketElement<TRoundData, TMatchData>({
      area: '.',
      type: 'colGap',
      elementHeight: headerOffset,
      partHeights: [headerOffset],
    });

    pushElement(headerGapElement);
  }

  const containerHeight = Math.max(elementHeight, totalHeight - headerOffset);

  const { element: continueElement } = createBracketElement<TRoundData, TMatchData>({
    area: 'continue',
    type: 'continue',
    elementHeight,
    partHeights: [containerHeight],
    component,
    matches,
  });

  pushElement(continueElement);

  pushSubColumn(subColumn);
  pushSection(masterColumnSection);

  return masterColumn;
};
