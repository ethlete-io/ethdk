import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS, Variant } from './fixture';

const LARGE_VARIANT = VARIANTS.find((variant) => variant.key === LARGE);

const change = (variant: Variant, at: Variant['change']) =>
  variant.change === at &&
  html`<span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED}">${TILE.change}</span>`;

const mini = (variant: Variant) => html`
  <div class="mini">
    ${change(variant, 'over')}
    <span class="mini-label">${TILE.label}</span>
    <span class="mini-row">
      <span class="mini-number">${TILE.number}</span>
      <span class="mini-unit">${TILE.unit}</span>
      ${change(variant, 'beside')}
    </span>
    ${change(variant, 'under')}
  </div>
`;

const marks = (variant: Variant) => html`
  <span class="marks">
    ${variant.verdict === 'chosen' && html`<span class="mark chosen">chosen</span>`}
    ${variant.verdict === 'rejected' && html`<span class="mark rejected">rejected</span>`}
    ${variant.stale && html`<span class="mark stale">stale</span>`}
  </span>
`;

const thumb = (variant: Variant) => html`
  <div class="thumb ${variant.key === LARGE && 'on'}">
    <div class="thumb-pic ${variant.verdict === 'rejected' && 'dim'}">${mini(variant)}</div>
    <span class="thumb-name">${variant.name}</span>
    ${marks(variant)}
  </div>
`;

const large = (variant: Variant) => html`
  <div class="large">
    <div class="large-pic ${variant.verdict === 'rejected' && 'dim'}">${mini(variant)}</div>

    <div class="large-foot">
      <span class="large-name">${variant.name}</span>
      ${marks(variant)}
    </div>

    <div class="verbs">${VERBS.map((verb) => html`<span class="verb">${verb}</span>`)}</div>
  </div>
`;

export default drawing({
  body: html`
    <div class="window">
      <div class="rail">
        <div class="filter"></div>
        <div class="rail-row"><span class="bar wide"></span><span class="bar"></span></div>
        <div class="rail-row on">
          <span class="rail-eyebrow">${CALL.eyebrow}</span>
          <span class="rail-headline">${CALL.headline}</span>
        </div>
        <div class="rail-row"><span class="bar wide"></span><span class="bar"></span></div>
      </div>

      <div class="stage">
        <div class="column">${VARIANTS.map(thumb)}</div>
        ${LARGE_VARIANT && large(LARGE_VARIANT)}
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

    .window {
      display: flex;
      width: 128rem;
      height: 72rem;
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

    .filter {
      height: 2.8rem;
      margin-bottom: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    .rail-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    .rail-row.on {
      gap: 0.4rem;
      background: ${PLATE};
    }

    .bar {
      height: 0.9rem;
      width: 60%;
      border-radius: 999px;
      background: ${LINE};
    }

    .bar.wide {
      width: 88%;
    }

    .rail-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .rail-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    .stage {
      display: flex;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 0 0 19rem;
      overflow: hidden;
    }

    .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 0 0 auto;
      padding: 0.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    .thumb.on {
      border-color: ${INK};
    }

    .thumb-pic {
      display: flex;
      align-items: center;
      height: 4.4rem;
      padding: 0 0.8rem;
      border-radius: 0.3rem;
      background: ${GROUND};
      --mini-label: 0.8rem;
      --mini-number: 2rem;
      --mini-unit: 0.9rem;
      --mini-change: 0.85rem;
      --mini-gap: 0.1rem;
      --mini-gap-x: 0.3rem;
    }

    .thumb-name {
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    .dim {
      opacity: 0.45;
    }

    .marks {
      display: flex;
      gap: 0.5rem;
    }

    .mark {
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .mark.chosen {
      color: ${ACCENT};
    }

    .mark.rejected {
      color: ${MUTED};
    }

    .mark.stale {
      padding: 0 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.2rem;
      color: ${MUTED};
    }

    .mini {
      display: flex;
      flex-direction: column;
      gap: var(--mini-gap);
    }

    .mini-row {
      display: flex;
      align-items: baseline;
      gap: var(--mini-gap-x);
    }

    .mini-label {
      font-size: var(--mini-label);
      color: ${MUTED};
    }

    .mini-number {
      font-size: var(--mini-number);
      line-height: 1;
      color: ${INK};
    }

    .mini-unit {
      font-size: var(--mini-unit);
      color: ${INK};
    }

    .mini-change {
      font-size: var(--mini-change);
      line-height: 1;
    }

    .large {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    .large-pic {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 auto;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${GROUND};
      --mini-label: 1.4rem;
      --mini-number: 6.4rem;
      --mini-unit: 2.2rem;
      --mini-change: 1.8rem;
      --mini-gap: 0.6rem;
      --mini-gap-x: 0.8rem;
    }

    .large-foot {
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
    }

    .large-name {
      font-size: 1.5rem;
    }

    .verbs {
      display: flex;
      gap: 0.8rem;
    }

    .verb {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }
  `,
});
