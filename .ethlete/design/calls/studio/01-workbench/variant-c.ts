import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS, Variant } from './fixture';

const change = (variant: Variant, at: Variant['change']) =>
  variant.change === at && html`<span class="mini-change ${variant.accent && 'is-accent'}">${TILE.change}</span>`;

const cell = (variant: Variant) => html`
  <div class="cell ${variant.key === LARGE && 'is-large'}">
    <div class="picture ${variant.verdict === 'rejected' && 'is-dimmed'}">
      <div class="mini">
        ${change(variant, 'over')}

        <span class="mini-label">${TILE.label}</span>

        <span class="mini-row">
          <span class="mini-number">${TILE.number}<span class="mini-unit">${TILE.unit}</span></span>

          ${change(variant, 'beside')}
        </span>

        ${change(variant, 'under')}
      </div>
    </div>

    <div class="meta">
      <span class="name">${variant.name}</span>

      <span class="marks">
        ${variant.stale && html`<span class="stale">stale</span>`}
        ${
          variant.verdict &&
          html`<span class="verdict ${variant.verdict === 'chosen' && 'is-chosen'}">${variant.verdict}</span>`
        }
      </span>
    </div>

    ${
      variant.key === LARGE &&
      html`<div class="verbs">${VERBS.map((verb) => html`<span class="verb">${verb}</span>`)}</div>`
    }
  </div>
`;

export default drawing({
  body: html`
    <div class="win">
      <div class="rail">
        <div class="search"></div>

        <div class="call-row">
          <span class="bar bar-eyebrow"></span>
          <span class="bar bar-headline"></span>
        </div>

        <div class="call-row is-current">
          <span class="eyebrow">${CALL.eyebrow}</span>
          <span class="call-headline">${CALL.headline}</span>
        </div>

        <div class="call-row">
          <span class="bar bar-eyebrow"></span>
          <span class="bar bar-headline"></span>
        </div>
      </div>

      <div class="stage">
        <div class="stage-head">
          <span class="stage-title">${CALL.feature}</span>
          <span class="stage-count">${VARIANTS.length} variants</span>
        </div>

        <div class="grid">${VARIANTS.map(cell)}</div>
      </div>
    </div>
  `,
  styles: css`
    #root {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    .win {
      display: flex;
      width: 128rem;
      height: 78rem;
      border: 1px solid ${LINE};
      background: ${GROUND};
      overflow: hidden;
    }

    .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    .search {
      height: 3.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    .call-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.6rem;
    }

    .call-row.is-current {
      background: ${PLATE};
    }

    .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
      color: ${INK};
    }

    .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.4rem;
      background: ${LINE};
    }

    .bar-eyebrow {
      width: 45%;
      height: 0.6rem;
    }

    .bar-headline {
      width: 85%;
      height: 1rem;
    }

    .stage {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      flex: 1;
      min-width: 0;
      padding: 1.6rem;
    }

    .stage-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    .stage-title {
      font-size: 1.4rem;
      color: ${INK};
    }

    .stage-count {
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-auto-rows: 20.6rem;
      gap: 1.2rem;
      align-content: start;
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
    }

    .cell.is-large {
      grid-column: span 2;
      grid-row: span 2;
      padding: 1.4rem;
    }

    .picture {
      display: grid;
      place-items: center;
      flex: 1;
      min-height: 0;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${GROUND};
    }

    .picture.is-dimmed {
      opacity: 0.45;
    }

    .mini {
      display: flex;
      flex-direction: column;
      gap: 0.3em;
      font-size: 1rem;
    }

    .cell.is-large .mini {
      font-size: 2rem;
    }

    .mini-label {
      font-size: 1.1em;
      letter-spacing: 0.04em;
      color: ${MUTED};
    }

    .mini-row {
      display: flex;
      align-items: baseline;
      gap: 0.5em;
    }

    .mini-number {
      font-size: 2.8em;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
      color: ${INK};
    }

    .mini-unit {
      margin-left: 0.12em;
      font-size: 0.42em;
      color: ${INK};
    }

    .mini-change {
      font-size: 1.1em;
      font-variant-numeric: tabular-nums;
      color: ${MUTED};
    }

    .mini-change.is-accent {
      color: ${ACCENT};
    }

    .meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
    }

    .name {
      min-width: 0;
      font-size: 1.1rem;
      line-height: 1.3;
      color: ${INK};
    }

    .cell.is-large .name {
      font-size: 1.4rem;
    }

    .marks {
      display: flex;
      gap: 0.5rem;
      flex: none;
    }

    .stale,
    .verdict {
      padding: 0.1rem 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .verdict.is-chosen {
      border-color: ${ACCENT};
      color: ${ACCENT};
    }

    .verbs {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    .verb {
      padding: 0.4rem 1.1rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.1rem;
      color: ${INK};
    }
  `,
});
