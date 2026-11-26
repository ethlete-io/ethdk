import { VARIANTS as SETTLED } from '../03-verdict-mark/fixture';

export { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VERBS } from '../01-workbench/fixture';
export type { Variant } from '../01-workbench/fixture';

/** Variant b was drawn again after it was rejected, so a ruled tile is out of date as well as faded. */
export const VARIANTS = SETTLED.map((variant) => (variant.key === 'b' ? { ...variant, stale: true } : variant));
