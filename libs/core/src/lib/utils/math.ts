export const clamp = (value: number, min = 0, max = 100) => {
  return Math.max(min, Math.min(max, value));
};

export const round = (value: number, precision = 0) => {
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
};
