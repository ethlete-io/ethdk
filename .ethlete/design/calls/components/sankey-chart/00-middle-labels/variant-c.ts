import { css, drawing, html } from '@design-explore';
import { COLUMN_STEP, LABEL_PADDING, chart, frameStyles, type SankeyNode } from './fixture';

const LABEL_LIFT = 2;

const middleLabel = (node: SankeyNode) =>
  html`<span
    class="label above"
    style="left: ${node.x}px; top: ${node.y - LABEL_LIFT}px; max-width: ${COLUMN_STEP - LABEL_PADDING}px"
    >${node.name}</span
  >`;

export default drawing({
  body: chart(middleLabel),
  styles: css`
    ${frameStyles}

    .label.above {
      translate: 0 -100%;
    }
  `,
});
