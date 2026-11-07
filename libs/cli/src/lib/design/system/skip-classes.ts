import { NESTED_SCROLL_RULE } from './nested-scroll';
import { LOST_SURFACE_RULE, NESTED_SURFACE_RULE } from './surface-nesting';

export const ESCAPABLE_RULES = ['CLIPPED', 'WRAP', NESTED_SCROLL_RULE, NESTED_SURFACE_RULE, LOST_SURFACE_RULE];

/** The reason classes a `data-et-skip` may name: the render rules it escapes, and `COVERED` for the cover check. */
export const SKIP_CLASSES = [...ESCAPABLE_RULES, 'COVERED'];
