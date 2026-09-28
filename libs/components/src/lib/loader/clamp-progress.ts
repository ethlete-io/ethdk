export const clampProgress = (value: number) => (Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value)));
