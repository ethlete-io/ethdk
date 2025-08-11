export const calculateUpperLowerRatio = (upperRoundsCount: number, lowerRoundsCount: number) => {
  // In double elimination, after the first aligned column,
  // we need to distribute the remaining upper rounds across the remaining lower rounds
  const remainingUpperRounds = upperRoundsCount - 1; // Subtract the first round
  const remainingLowerRounds = lowerRoundsCount - 1; // Subtract the first round

  if (remainingUpperRounds === 0) {
    return 1; // Edge case: only one upper round
  }

  return remainingLowerRounds / remainingUpperRounds;
};

export const calculateColumnSplitFactor = (upperToLowerRatio: number) => {
  // The split factor determines how many sub-columns each match column will have
  // For example, if the ratio is 1.5, we split each match column
  // into 2 sub-columns so that matches can be centered correctly

  if (upperToLowerRatio === 1.5) {
    return 2; // Split into 2 sub-columns for 1.5 ratio
  }

  if (upperToLowerRatio === 2) {
    return 1; // Split into 1 sub-columns for 2 ratio
  }

  return 1;
};

export const calculateColumnPosition = (subColumnIndex: number, splitFactor: number) =>
  Math.floor(subColumnIndex / splitFactor);

export const calculateLowerRoundIndex = (subColumnIndex: number, splitFactor: number) =>
  Math.floor(subColumnIndex / splitFactor);

export const calculateUpperRoundIndex = (subColumnIndex: number, upperToLowerRatio: number, splitFactor: number) => {
  // Calculate which complete column we're in
  const completeColumnIndex = Math.floor(subColumnIndex / splitFactor);

  // For the first complete column (index 0), always use the first upper round (index 0)
  if (completeColumnIndex === 0) {
    return 0;
  }

  // For subsequent columns, map based on the ratio
  // We subtract 1 because the first column is handled separately
  const adjustedColumnIndex = completeColumnIndex - 1;

  // Calculate which upper round this column should use
  // We add 1 because we start from the second upper round (index 1)
  return Math.floor(adjustedColumnIndex / upperToLowerRatio) + 1;
};
