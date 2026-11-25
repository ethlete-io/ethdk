/**
 * Tied to the 130-260 degree range of `et-spinner-left-spin` / `et-spinner-right-spin`: the dash must reach past the
 * clip edge at 130 and its hidden end must stay a cap's width away from the edge at 260. A 180 degree dash ends
 * 10 degrees from the edge there and its round cap paints a stray dot opposite the arc.
 */
const SWEEP_DASH_FRACTION = 160 / 360;

export type SpinnerCircleDash = { dash: string; offset: number };

export const spinnerSweepDashes = (circumference: number) => {
  const dash = circumference * SWEEP_DASH_FRACTION;
  const sweepDash = `${dash}px ${circumference}px`;

  return {
    left: { dash: sweepDash, offset: 0 },
    gap: { dash: `${circumference}px`, offset: circumference / 2 },
    right: { dash: sweepDash, offset: dash - circumference / 2 },
  } satisfies Record<string, SpinnerCircleDash>;
};
