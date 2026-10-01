import { css, drawing, html } from '@design-explore';
import {
  BORDER,
  COLUMN_STEP,
  LABEL_PADDING,
  NODE_WIDTH,
  SURFACE,
  chart,
  endLabelMaxWidth,
  frameStyles,
  type SankeyNode,
} from './fixture';

const MIN_CHIP_NODE_HEIGHT = 24;

const middleLabel = (node: SankeyNode) =>
  node.height >= MIN_CHIP_NODE_HEIGHT
    ? html`<span
        class="label chip"
        style="left: ${node.x + NODE_WIDTH / 2}px; top: ${node.y + node.height / 2}px; max-width: ${COLUMN_STEP - 2 * LABEL_PADDING}px"
        >${node.name}</span
      >`
    : html`<span
        class="label"
        style="left: ${node.x + NODE_WIDTH + LABEL_PADDING}px; top: ${node.y + node.height / 2}px; max-width: ${endLabelMaxWidth(node)}px"
        >${node.name}</span
      >`;

export default drawing({
  body: chart(middleLabel),
  styles: css`
    ${frameStyles}

    .label.chip {
      box-sizing: border-box;
      padding: 1px 6px;
      border: 1px solid ${BORDER};
      border-radius: 4px;
      background: ${SURFACE};
      text-shadow: none;
      translate: -50% -50%;
    }
  `,
});
