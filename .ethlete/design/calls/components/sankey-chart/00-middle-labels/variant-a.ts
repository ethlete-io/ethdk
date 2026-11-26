import { css, drawing, html } from '@design-explore';
import { LABEL_PADDING, NODE_WIDTH, chart, endLabelMaxWidth, frameStyles, type SankeyNode } from './fixture';

const middleLabel = (node: SankeyNode) =>
  html`<span
    class="label"
    style="left: ${node.x + NODE_WIDTH + LABEL_PADDING}px; top: ${node.y + node.height / 2}px; max-width: ${endLabelMaxWidth(node)}px"
    >${node.name}</span
  >`;

export default drawing({
  body: chart(middleLabel),
  styles: css`
    ${frameStyles}
  `,
});
