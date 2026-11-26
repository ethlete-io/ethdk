import { css, drawing, html } from '@design-explore';
import { BORDER, MUTED, NODES, NODE_WIDTH, SURFACE, chart, frameStyles } from './fixture';

const TOOLTIP_OFFSET = 8;
const hovered = NODES.find((node) => node.id === 'landing');

const tooltip = hovered
  ? html`<div
      class="tooltip"
      style="left: ${hovered.x + NODE_WIDTH + TOOLTIP_OFFSET}px; top: ${hovered.y + hovered.height / 2}px"
    >
      <strong>${hovered.name}</strong>
      <span class="total">In <span class="value">${hovered.incoming}</span></span>
      <span class="total">Out <span class="value">${hovered.outgoing}</span></span>
    </div>`
  : '';

export default drawing({
  body: chart(() => '', tooltip),
  styles: css`
    ${frameStyles}

    .tooltip {
      position: absolute;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      max-inline-size: 220px;
      padding: 6px 10px;
      border: 1px solid ${BORDER};
      border-radius: 6px;
      background: ${SURFACE};
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
      translate: 0 -50%;
    }

    .tooltip .total {
      color: ${MUTED};
    }

    .tooltip .value {
      font-variant-numeric: tabular-nums;
    }
  `,
});
