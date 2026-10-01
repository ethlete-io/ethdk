import { css, drawing, html } from '@design-explore';
import { BORDER, CONTENT_WIDTH, MUTED, frameStyles, header, horizontalLabels, marks, sankey } from './fixture';

const MIN_WIDTH = 480;
const HEIGHT = 280;
const LABEL_WIDTH = 120;

const layout = sankey({ length: MIN_WIDTH, breadth: HEIGHT, insetStart: LABEL_WIDTH, insetEnd: LABEL_WIDTH });

export default drawing({
  body: html`
    ${header}
    <div class="scroller">
      <div class="plot" style="width: ${MIN_WIDTH}px">
        <svg width="${MIN_WIDTH}" height="${HEIGHT}">${marks(layout)}</svg>
        <div class="labels">${horizontalLabels(layout, LABEL_WIDTH)}</div>
      </div>
    </div>
    <p class="note">The plot keeps 480px; ${MIN_WIDTH - CONTENT_WIDTH}px of it sits past the screen edge.</p>
  `,
  styles: css`
    ${frameStyles}

    .scroller {
      width: ${CONTENT_WIDTH}px;
      overflow-x: scroll;
      padding-block: 0.7em;
      scrollbar-width: thin;
      scrollbar-color: ${MUTED} ${BORDER};
    }
  `,
});
