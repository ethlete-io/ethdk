import { css, drawing, html } from '@design-explore';
import { ENTRIES, containers, donut, frameStyles, swatch } from './fixture';

const chart = () => html`
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
`;

export default drawing({
  body: containers(chart),
  styles: css`
    ${frameStyles}

    .legend {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      column-gap: 24px;
      row-gap: 4px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto 3.5em;
      align-items: center;
      column-gap: 8px;
    }
  `,
});
