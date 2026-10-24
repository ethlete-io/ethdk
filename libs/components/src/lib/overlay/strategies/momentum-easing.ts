/**
 * A `cubic-bezier` whose start and end speed are the given multiples of the transition's average
 * speed, so a transition can pick up a gesture at the speed it let go with. The start is capped at 3x,
 * the steepest a bezier with these x control points can start without overshooting.
 */
export const slopeMatchedEasing = (startSlope: number, endSlope: number) =>
  `cubic-bezier(0.333, ${(Math.min(3, startSlope) / 3).toFixed(3)}, 0.667, ${(1 - endSlope / 3).toFixed(3)})`;
