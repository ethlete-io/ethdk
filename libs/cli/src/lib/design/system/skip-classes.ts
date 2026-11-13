import { CONTROL_HEIGHT_RULE } from './control-height';

export const ESCAPABLE_RULES = ['CLIPPED', 'WRAP', CONTROL_HEIGHT_RULE];

/**
 * The reason classes a `data-et-skip` may name: the render rules it escapes, and `COVERED` for the cover check.
 * `OFF-CENTRE`, `LOST-SURFACE` and `NESTED-SCROLL` escape nothing; they stay accepted while ready studio parts carry
 * them.
 */
export const SKIP_CLASSES = [...ESCAPABLE_RULES, 'COVERED', 'OFF-CENTRE', 'LOST-SURFACE', 'NESTED-SCROLL'];
