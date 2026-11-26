export const SIDE_WIDTH = { min: 200, rest: 248, max: 400, step: 8 } as const;

export const clampSideWidth = (width: number) =>
  Number.isFinite(width) ? Math.round(Math.min(SIDE_WIDTH.max, Math.max(SIDE_WIDTH.min, width))) : SIDE_WIDTH.rest;

const KEY_STEPS: Partial<Record<string, number>> = { ArrowLeft: -SIDE_WIDTH.step, ArrowRight: SIDE_WIDTH.step };

export const sideWidthForKey = (width: number, key: string) => {
  const step = KEY_STEPS[key];

  return step === undefined ? null : clampSideWidth(width + step);
};
