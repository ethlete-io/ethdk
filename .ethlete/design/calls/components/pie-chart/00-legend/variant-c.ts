import { css, drawing, html } from '@design-explore';
import { BORDER, ENTRIES, INK, MUTED, SURFACE, containers, donut, frameStyles, sliceAnchor, swatch } from './fixture';

const HOVERED = 0;
const TOOLTIP_OFFSET = 8;
const hovered = ENTRIES[HOVERED];

const tooltip = () => {
  if (!hovered) return '';
  const anchor = sliceAnchor(hovered);

  return html`<div class="tooltip" style="left: ${anchor.x + TOOLTIP_OFFSET}px; top: ${anchor.y}px">
    <span class="tooltip-value">${hovered.valueText}</span>
    <span class="tooltip-label">${hovered.label} · ${hovered.percentText}</span>
  </div>`;
};

const chart = () => html`
  <div class="chart-legend">
    <ul class="list">
      ${ENTRIES.map(
        (entry) =>
          html`<li class="item">
            ${swatch(entry)}
            <span class="ellipsis">${entry.label}</span>
          </li>`,
      )}
    </ul>
  </div>
  ${donut(HOVERED, tooltip())}
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

    .tooltip {
      position: absolute;
      z-index: 1;
      display: flex;
      align-items: baseline;
      gap: 6px;
      inline-size: max-content;
      max-inline-size: 240px;
      padding: 6px 10px;
      border: 1px solid ${BORDER};
      border-radius: 6px;
      background: ${SURFACE};
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
      color: ${INK};
      translate: 0 -50%;
    }

    .tooltip-value {
      font-variant-numeric: tabular-nums;
    }

    .tooltip-label {
      color: ${MUTED};
    }
  `,
});
