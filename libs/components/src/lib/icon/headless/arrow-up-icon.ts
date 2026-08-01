import { IconDefinition } from './icon-provider';

/**
 * Upward arrow. Rotate it 180° for the downward one - see the table's sort indicator.
 *
 * Drawn to fill its viewBox and sit centred in it (the shaft spans 3.5–20.5 of 24, so the glyph's
 * midpoint is the box's). An arrow inset from its own box renders far smaller than the text it sits
 * beside, and off-centre against it, however carefully the box itself is aligned.
 */
export const ARROW_UP_ICON: IconDefinition = {
  name: 'et-arrow-up',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        d="M12 20.5V3.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M5.5 10L12 3.5 18.5 10"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
};
