export const toPageCount = (value: number) => (Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0);

export const toCount = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(Math.floor(value), 0) : fallback;
