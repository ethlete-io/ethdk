import { css, drawing, html } from '@design-explore';
import { ENTRIES, LEGEND_GAP, containers, donut, frameStyles, swatch } from './fixture';

const chart = () => html`
  <div class="figure">
    ${donut()}
    <ul class="legend">
      ${ENTRIES.map(
        (entry) =>
          html`<li class="item">
            ${swatch(entry)}
            <span class="ellipsis">${entry.label}</span>
            <span class="num value">${entry.valueText}</span>
            <span class="num">${entry.percentText}</span>
          </li>`,
      )}
    </ul>
  </div>
`;

export default drawing({
  body: containers(chart),
  styles: css`
    ${frameStyles}

    .figure {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: ${LEGEND_GAP}px;
    }

    .legend {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      flex: 1 1 160px;
      max-inline-size: 360px;
      align-items: center;
      column-gap: 8px;
      row-gap: 6px;
      min-inline-size: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: contents;
    }
  `,
});
