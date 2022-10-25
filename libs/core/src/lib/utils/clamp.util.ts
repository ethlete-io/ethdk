export const clamp = (value: number, min = 0, max = 100) => {
  return Math.max(min, Math.min(max, value));
};
