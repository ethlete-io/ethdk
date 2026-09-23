import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS, Variant } from './fixture';

const change = (variant: Variant, at: Variant['change']) =>
  variant.change === at && html`<span class="change ${variant.accent && 'accent'}">${TILE.change}</span>`;

const mini = (variant: Variant, size: string) => html`
  <div class="mini ${size}">
    ${change(variant, 'over')}
    <span class="label">${TILE.label}</span>
    <span class="figure">
      <span class="number">${TILE.number}</span>
      <span class="unit">${TILE.unit}</span>
      ${change(variant, 'beside')}
    </span>
    ${change(variant, 'under')}
  </div>
`;

const verdict = (variant: Variant) =>
  variant.verdict && html`<span class="verdict ${variant.verdict === 'chosen' && 'chosen'}">${variant.verdict}</span>`;

const stale = (variant: Variant) => variant.stale && html`<span class="stale">stale</span>`;

const hero = (variant: Variant) => html`
  <div class="hero">
    <div class="hero-head">
      <span class="hero-name">${variant.name}</span>
      ${stale(variant)} ${verdict(variant)}
    </div>

    <div class="hero-picture ${variant.verdict === 'rejected' && 'dimmed'}">${mini(variant, 'large')}</div>

    <div class="verbs">${VERBS.map((verb) => html`<span class="verb">${verb}</span>`)}</div>
  </div>
`;

const thumb = (variant: Variant) => html`
  <div class="thumb ${variant.key === LARGE && 'open'}">
    <div class="thumb-picture ${variant.verdict === 'rejected' && 'dimmed'}">${mini(variant, '')}</div>

    <span class="thumb-name">${variant.name}</span>

    <div class="markers">${verdict(variant)} ${stale(variant)}</div>
  </div>
`;

export default drawing({
  body: html`
    <div class="window">
      <div class="rail">
        <div class="search">Search</div>
        <div class="calls">
          <div class="call">
            <span class="bar eyebrow-bar"></span>
            <span class="bar headline-bar"></span>
          </div>
          <div class="call open">
            <span class="eyebrow">${CALL.eyebrow}</span>
            <span class="headline">${CALL.headline}</span>
          </div>
          <div class="call">
            <span class="bar eyebrow-bar"></span>
            <span class="bar headline-bar"></span>
          </div>
        </div>
      </div>

      <div class="stage">
        ${VARIANTS.map((variant) => variant.key === LARGE && hero(variant))}

        <div class="strip">
          <div class="strip-head">
            <span class="strip-title">All ${VARIANTS.length} variants</span>
            <span class="strip-note">a ninth starts a second row, and the large one moves up</span>
          </div>

          <div class="thumbs">${VARIANTS.map(thumb)}</div>
        </div>
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
      gap: 1.6rem;
      width: 23rem;
      flex: none;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    .search {
      padding: 0.8rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .calls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .call {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.4rem;
    }

    .call.open {
      background: ${PLATE};
    }

    .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .headline {
      font-size: 1.3rem;
      line-height: 1.3;
    }

    .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    .eyebrow-bar {
      width: 4.8rem;
      height: 0.6rem;
    }

    .headline-bar {
      width: 100%;
      height: 1.2rem;
    }

    .stage {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-width: 0;
      padding: 1.6rem;
    }

    .hero {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-height: 0;
      padding: 1.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    .hero-head {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      flex: none;
    }

    .hero-name {
      font-size: 1.4rem;
    }

    .hero-picture {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-height: 0;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
    }

    .verbs {
      display: flex;
      gap: 0.8rem;
      flex: none;
    }

    .verb {
      padding: 0.6rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 1.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .strip {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      height: 20rem;
      flex: none;
    }

    .strip-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .strip-title {
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .thumbs {
      display: flex;
      gap: 0.8rem;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      width: 12rem;
      flex: none;
      padding: 0.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    .thumb.open {
      border-color: ${ACCENT};
    }

    .thumb-picture {
      display: flex;
      flex: 1;
      align-items: center;
      min-height: 0;
    }

    .thumb-name {
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    .markers {
      display: flex;
      gap: 0.6rem;
      min-height: 1.4rem;
    }

    .dimmed {
      opacity: 0.45;
    }

    .verdict {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .verdict.chosen {
      color: ${ACCENT};
    }

    .stale {
      padding: 0 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      font-size: 1rem;
      line-height: 1.6rem;
      color: ${MUTED};
    }

    .mini {
      display: flex;
      flex-direction: column;
      gap: 0.4em;
      font-size: 1rem;
    }

    .mini.large {
      font-size: 2.4rem;
    }

    .label {
      font-size: 1.1em;
      color: ${MUTED};
    }

    .figure {
      display: flex;
      align-items: baseline;
      gap: 0.3em;
    }

    .number {
      font-size: 3.2em;
      line-height: 1;
      color: ${INK};
      font-variant-numeric: tabular-nums;
    }

    .unit {
      font-size: 1.2em;
      color: ${INK};
    }

    .change {
      font-size: 1.2em;
      color: ${MUTED};
      font-variant-numeric: tabular-nums;
    }

    .change.accent {
      color: ${ACCENT};
    }
  `,
});
