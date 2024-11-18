import {
  BracketData,
  BracketRoundTypeMap,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  TOURNAMENT_MODE,
} from './bracket-new';

export type generateBracketGridDefinitionsOptions = {
  includeRoundHeaders: boolean;
};

const generateColumnCount = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
) => {
  const thirdPlaceRoundSize = roundTypeMap.get(COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE)?.size || 0;

  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
      const upperBracketSize = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.size || 0;
      const lowerBracketSize = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.size || 0;

      // the total columns are the bigger number of winner bracket rounds vs looser bracket rounds + all other rounds excluding third place
      return bracketData.rounds.size - thirdPlaceRoundSize + Math.max(upperBracketSize, lowerBracketSize);
    }
    default: {
      // the total columns are the amount of rounds excluding third place
      return bracketData.rounds.size - thirdPlaceRoundSize;
    }
  }
};

const generateRowCount = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  options: generateBracketGridDefinitionsOptions,
) => {
  switch (bracketData.mode) {
    case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
      const upperBracketSize = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.UPPER_BRACKET)?.values().next()
        .value?.matchCount;
      const lowerBracketSize = roundTypeMap.get(DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET)?.values().next()
        .value?.matchCount;
      const roundHeadersCount = options.includeRoundHeaders ? 2 : 0;

      if (upperBracketSize === undefined || lowerBracketSize === undefined) {
        throw new Error('Upper or lower bracket size is undefined');
      }

      // the total rows the amount of matches in the first upper bracket round + first lower bracket round + if true, the round header row for both
      return upperBracketSize + lowerBracketSize + roundHeadersCount;
    }
    default: {
      const firstRoundSize = bracketData.rounds.values().next().value?.matchCount;
      const roundHeadersCount = options.includeRoundHeaders ? 1 : 0;

      if (firstRoundSize === undefined) {
        throw new Error('First round size is undefined');
      }

      // the total rows are the amount of matches in the first round + if true, the round header row
      return firstRoundSize + roundHeadersCount;
    }
  }
};

export const generateBracketGridDefinitions = <TRoundData, TMatchData>(
  bracketData: BracketData<TRoundData, TMatchData>,
  roundTypeMap: BracketRoundTypeMap<TRoundData, TMatchData>,
  options: generateBracketGridDefinitionsOptions,
) => {
  const columnCount = generateColumnCount(bracketData, roundTypeMap);
  const rowCount = generateRowCount(bracketData, roundTypeMap, options);

  return { columnCount, rowCount };
};
