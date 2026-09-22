import { VARIANTS as DRAWN } from '../01-workbench/fixture';

export { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VERBS } from '../01-workbench/fixture';
export type { Variant } from '../01-workbench/fixture';

/** Round 1 of the call is settled, so the column carries all three states at once. */
export const VARIANTS = DRAWN.map((variant) =>
  variant.key === 'a' ? { ...variant, verdict: 'chosen' as const } : variant,
);
