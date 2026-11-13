import { CONTROL_HEIGHT_RULE } from './control-height';
import { OFF_CENTRE_RULE } from './off-centre';

export const ESCAPABLE_RULES = ['CLIPPED', 'WRAP', OFF_CENTRE_RULE, CONTROL_HEIGHT_RULE];

/**
 * The reason classes a `data-et-skip` may name: the render rules it escapes, and `COVERED` for the cover check.
 * `LOST-SURFACE` and `NESTED-SCROLL` escape nothing; they stay accepted while the ready studio sketch
 * foundations-colors carries them.
 */
export const SKIP_CLASSES = [...ESCAPABLE_RULES, 'COVERED', 'LOST-SURFACE', 'NESTED-SCROLL'];
