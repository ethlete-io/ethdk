import { css, drawing, html } from '@design-explore';
import { CONTENT_WIDTH, NODE_WIDTH, frameStyles, header, marks, sankey } from './fixture';

const LENGTH = 400;
const INSET = 22;

const layout = sankey({ length: LENGTH, breadth: CONTENT_WIDTH, insetStart: INSET, insetEnd: INSET, vertical: true });
const lastColumn = Math.max(...layout.nodes.map((node) => node.column));

const labels = layout.nodes.map((node) => {
  const above = node.column === 0;
  const y = above ? node.along - 4 : node.along + NODE_WIDTH + 4;
  const side = above ? 'above' : node.column === lastColumn ? 'below' : 'inside';
  return html`<span class="v-label" data-side="${side}" style="left: ${node.across + node.size / 2}px; top: ${y}px"
    >${node.label}</span
  >`;
});

export default drawing({
  body: html`
    ${header}
    <div class="plot" style="width: ${CONTENT_WIDTH}px">
      <svg width="${CONTENT_WIDTH}" height="${LENGTH}">${marks(layout, true)}</svg>
      <div class="labels">${labels}</div>
    </div>
    <p class="note">Below 480px the flow turns: columns become rows, read top to bottom.</p>
  `,
  styles: css`
    ${frameStyles}

    .v-label {
      position: absolute;
      white-space: nowrap;
      translate: -50% 0;
      text-shadow:
        0 0 2px #fff,
        0 0 4px #fff;
    }

    .v-label[data-side='above'] {
      translate: -50% -100%;
    }
  `,
});
