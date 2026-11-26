import { css, drawing, html } from '@design-explore';
import { CONTENT_WIDTH, frameStyles, header, horizontalLabels, marks, sankey } from './fixture';

const HEIGHT = 280;
const LABEL_WIDTH = 64;

const layout = sankey({ length: CONTENT_WIDTH, breadth: HEIGHT, insetStart: LABEL_WIDTH, insetEnd: LABEL_WIDTH });

export default drawing({
  body: html`
    ${header}
    <div class="plot" style="width: ${CONTENT_WIDTH}px; padding-block: 0.7em">
      <svg width="${CONTENT_WIDTH}" height="${HEIGHT}">${marks(layout)}</svg>
      <div class="labels" style="top: 0.7em">${horizontalLabels(layout, LABEL_WIDTH)}</div>
    </div>
    <p class="note">The plot shrinks to the screen; the label gutters drop from 120px to 64px.</p>
  `,
  styles: css`
    ${frameStyles}
  `,
});
