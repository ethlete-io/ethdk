import { CONTROL_HEIGHT_RULE } from './control-height';
import { NESTED_SCROLL_RULE } from './nested-scroll';
import { OFF_CENTRE_RULE } from './off-centre';
import { LOST_SURFACE_RULE } from './surface-nesting';

export const ESCAPABLE_RULES = [
  'CLIPPED',
  'WRAP',
  NESTED_SCROLL_RULE,
  LOST_SURFACE_RULE,
  OFF_CENTRE_RULE,
  CONTROL_HEIGHT_RULE,
];

/** The reason classes a `data-et-skip` may name: the render rules it escapes, and `COVERED` for the cover check. */
export const SKIP_CLASSES = [...ESCAPABLE_RULES, 'COVERED'];
