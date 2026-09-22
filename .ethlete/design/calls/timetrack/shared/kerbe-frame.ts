import { css, html } from '@design-explore';
import { KERBE_VARS } from './kerbe';

const GROUND_RULES =
  KERBE_VARS +
  `
  display: block;
  padding: 1.6rem;
  background: var(--k-ground);
  font-family: var(--k-sans);
  font-weight: 300;
  color: var(--k-ink-2);
`;

const LANE_RULES = `
  display: flex;
  flex-direction: column;
`;

/** Draws the ground a single option sits on, at the lane width the call fixes. */
export const kerbeFrame = ({ widthRem = 24, gapRem = 0, body }: { widthRem?: number; gapRem?: number; body: string }) =>
  html`<div class="lane" style="width: ${widthRem}rem; gap: ${gapRem}rem">${body}</div>`;

/** The styles `kerbeFrame` needs, for a drawing to include in its own `styles`. */
export const KERBE_FRAME_STYLES = css`
  #root {
    ${GROUND_RULES}
  }

  .lane {
    ${LANE_RULES}
  }
`;
