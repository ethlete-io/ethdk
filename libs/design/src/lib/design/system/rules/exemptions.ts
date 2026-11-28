import { Layer } from '../layers';

const EXEMPT_LAYERS = {
  'HARD-CODED-COLOUR': ['foundations'],
  'HARD-CODED-MOTION': ['foundations'],
  'INLINE-SVG': ['foundations'],
  'UTILITY-CSS': ['foundations'],
  'DENIED-CLASS': ['foundations'],
} as const satisfies Record<string, readonly Layer[]>;

export type ExemptibleRule = keyof typeof EXEMPT_LAYERS;

export const EXEMPTIBLE_RULES = Object.keys(EXEMPT_LAYERS) as ExemptibleRule[];

/**
 * Whether `rule` skips a part of this layer. The product check and the sketch check of a copy of the part both ask
 * with the target part, never with the path of the file under check.
 */
export const isExemptFrom = (rule: ExemptibleRule, part: { layer: Layer }) =>
  (EXEMPT_LAYERS[rule] as readonly Layer[]).includes(part.layer);
