export const toPageCount = (value: number) => (Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0);
