export const calculateUpperLowerRatio = (upperRoundsCount: number, lowerRoundsCount: number) => {
  const remainingUpperRounds = upperRoundsCount - 1;
  const remainingLowerRounds = lowerRoundsCount - 1;

  if (remainingUpperRounds === 0) return 1;

  return remainingLowerRounds / remainingUpperRounds;
};

export const calculateColumnSplitFactor = (upperToLowerRatio: number) => (upperToLowerRatio === 1.5 ? 2 : 1);

export const calculateLowerRoundIndex = (subColumnIndex: number, splitFactor: number) =>
  Math.floor(subColumnIndex / splitFactor);

// eslint-disable-next-line max-params -- index math over positional grid coordinates
export const calculateUpperRoundIndex = (subColumnIndex: number, upperToLowerRatio: number, splitFactor: number) => {
  const completeColumnIndex = Math.floor(subColumnIndex / splitFactor);

  if (completeColumnIndex === 0) return 0;

  return Math.floor((completeColumnIndex - 1) / upperToLowerRatio) + 1;
};
