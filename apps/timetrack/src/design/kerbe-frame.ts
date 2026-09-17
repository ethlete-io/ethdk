import { Component, input, ViewEncapsulation } from '@angular/core';
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

/** The ground a single option is drawn on, at the lane width the call fixes. */
@Component({
  selector: 'ethlete-design-kerbe-frame',
  template: `
    <div [style.width.rem]="widthRem()" [style.gap.rem]="gapRem()" class="lane">
      <ng-content />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-kerbe-frame {
      ${GROUND_RULES}
    }

    ethlete-design-kerbe-frame .lane {
      ${LANE_RULES}
    }
  `,
})
export class KerbeFrameComponent {
  public widthRem = input(24);
  public gapRem = input(0);
}

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
