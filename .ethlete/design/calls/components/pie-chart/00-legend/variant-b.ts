import { css, drawing, html } from '@design-explore';
import { ENTRIES, containers, donut, frameStyles, swatch } from './fixture';

const chart = () => html`
  <div class="chart-legend">
    <ul class="list">
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
  ${donut()}
`;

export default drawing({
  body: containers(chart),
  styles: css`
    ${frameStyles}

    .chart-legend {
      margin-block-end: 12px;
    }

    .list {
      display: flex;
      flex-wrap: wrap;
      column-gap: 16px;
      row-gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }

    .item .num {
      flex: none;
    }
  `,
});
