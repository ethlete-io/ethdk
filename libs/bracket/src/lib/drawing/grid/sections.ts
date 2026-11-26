import { COMMON_BRACKET_ROUND_TYPE, DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE } from '../../core';
import { BracketRound } from '../../linked';
import { Dimensions, FinalizedBracketColumn } from './core';

export const BRACKET_SECTION_KEY = {
  UPPER: 'upper',
  LOWER: 'lower',
  FINALS: 'finals',
} as const;

export type BracketSectionKey = (typeof BRACKET_SECTION_KEY)[keyof typeof BRACKET_SECTION_KEY];

/** The English name of each section, for a renderer that brings no labels of its own. */
export const BRACKET_SECTION_DEFAULT_NAMES: Record<BracketSectionKey, string> = {
  upper: 'Upper bracket',
  lower: 'Lower bracket',
  finals: 'Finals',
};

/**
 * One part of a bracket - double elimination's upper bracket, lower bracket or finals - as a grid builder
 * placed it.
 */
export type BracketGridSection<TRoundData = unknown, TMatchData = unknown> = {
  key: BracketSectionKey;
  name: string;
  rounds: BracketRound<TRoundData, TMatchData>[];
  /** The box around the section's round headers and matches, from the top of the grid rows it occupies. */
  dimensions: Dimensions;
  /** The band above `dimensions` the grid reserved for the section's title - `sectionTitleHeight` high. */
  titleDimensions: Dimensions;
};

/** The section a double elimination round belongs to: the third place playoff counts as one of the finals. */
export const doubleEliminationRoundSection = (round: BracketRound<unknown, unknown>): BracketSectionKey => {
  switch (round.type) {
    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET:
      return BRACKET_SECTION_KEY.UPPER;

    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET:
      return BRACKET_SECTION_KEY.LOWER;

    case COMMON_BRACKET_ROUND_TYPE.FINAL:
    case DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL:
    case COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE:
    default:
      return BRACKET_SECTION_KEY.FINALS;
  }
};

/**
 * Groups a finalized grid's headers and matches into sections and measures each one, with its title band
 * `titleHeight` px above it. A section starts at its `tops` entry, where the grid builder gives one, so the
 * titles of sections that share a row line up; otherwise at its highest element. Sections come in
 * {@link BRACKET_SECTION_KEY} order; an empty one is left out.
 */
export const createBracketGridSections = <TRoundData, TMatchData>(config: {
  columns: FinalizedBracketColumn<TRoundData, TMatchData>[];
  sectionOf: (round: BracketRound<TRoundData, TMatchData>) => BracketSectionKey;
  titleHeight: number;
  tops?: Partial<Record<BracketSectionKey, number>>;
}): BracketGridSection<TRoundData, TMatchData>[] => {
  const found = new Map<
    BracketSectionKey,
    { rounds: Set<BracketRound<TRoundData, TMatchData>>; top: number; left: number; right: number; bottom: number }
  >();

  for (const column of config.columns) {
    for (const element of column.elements) {
      if (element.type === 'continue') continue;

      const key = config.sectionOf(element.round);
      const { top, left, width, height } = element.dimensions;
      const box = found.get(key);

      if (!box) {
        found.set(key, { rounds: new Set([element.round]), top, left, right: left + width, bottom: top + height });
        continue;
      }

      box.rounds.add(element.round);
      box.top = Math.min(box.top, top);
      box.left = Math.min(box.left, left);
      box.right = Math.max(box.right, left + width);
      box.bottom = Math.max(box.bottom, top + height);
    }
  }

  return Object.values(BRACKET_SECTION_KEY).flatMap((key) => {
    const box = found.get(key);

    if (!box) return [];

    const width = box.right - box.left;
    const top = config.tops?.[key] ?? box.top;

    return [
      {
        key,
        name: BRACKET_SECTION_DEFAULT_NAMES[key],
        rounds: Array.from(box.rounds),
        dimensions: { top, left: box.left, width, height: box.bottom - top },
        titleDimensions: { top: top - config.titleHeight, left: box.left, width, height: config.titleHeight },
      },
    ];
  });
};
