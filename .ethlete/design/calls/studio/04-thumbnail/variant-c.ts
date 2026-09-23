import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

const LARGE_VARIANT = VARIANTS.find((variant) => variant.key === LARGE);
const variant = LARGE_VARIANT;

import { css, drawing, html } from '@design-explore';

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
        <div class="column">
          ${VARIANTS.map(
            (variant) => html`
              <div class="thumb${variant.key === LARGE && 'on'}${variant.verdict === 'rejected' && 'faded'}">
                ${
                  variant.stale
                    ? html`
                        <div class="thumb-pic waiting${variant.verdict === 'chosen' && 'picked'}">
                          <span class="waiting-name">${variant.name}</span>
                          <span class="waiting-note">
                            <span class="dots">
                              <span class="dot"></span>
                              <span class="dot"></span>
                              <span class="dot"></span>
                            </span>
                            <span>drawing a new picture</span>
                          </span>
                        </div>
                      `
                    : html`
                        <div class="thumb-pic${variant.verdict === 'chosen' && 'picked'}">
                          <div class="mini">
                            ${
                              variant.change === 'over' &&
                              html`
                                <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};"
                                  >${TILE.change}</span
                                >
                              `
                            }
                            <span class="mini-label">${TILE.label}</span>
                            <span class="mini-row">
                              <span class="mini-number">${TILE.number}</span>
                              <span class="mini-unit">${TILE.unit}</span>
                              ${
                                variant.change === 'beside' &&
                                html`
                                  <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};"
                                    >${TILE.change}</span
                                  >
                                `
                              }
                            </span>
                            ${
                              variant.change === 'under' &&
                              html`
                                <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};"
                                  >${TILE.change}</span
                                >
                              `
                            }
                          </div>
                        </div>
                      `
                }
                <div class="thumb-foot">
                  <span class="thumb-name${variant.verdict === 'chosen' && 'picked'}">${variant.name}</span>
                </div>
              </div>
            `,
          )}
        </div>

        ${
          variant &&
          html`
            <div class="large">
              <div class="large-pic${variant.verdict === 'rejected' && 'dim'}">
                <div class="mini">
                  ${
                    variant.change === 'over' &&
                    html`
                      <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};">${TILE.change}</span>
                    `
                  }
                  <span class="mini-label">${TILE.label}</span>
                  <span class="mini-row">
                    <span class="mini-number">${TILE.number}</span>
                    <span class="mini-unit">${TILE.unit}</span>
                    ${
                      variant.change === 'beside' &&
                      html`
                        <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};"
                          >${TILE.change}</span
                        >
                      `
                    }
                  </span>
                  ${
                    variant.change === 'under' &&
                    html`
                      <span class="mini-change" style="color: ${variant.accent ? ACCENT : MUTED};">${TILE.change}</span>
                    `
                  }
                </div>
              </div>

              <div class="large-foot">
                <span class="large-name">${variant.name}</span>
                <span class="marks">
                  ${
                    variant.verdict === 'chosen'
                      ? html` <span class="mark chosen">chosen</span> `
                      : variant.verdict === 'rejected'
                        ? html` <span class="mark rejected">rejected</span> `
                        : ''
                  }
                  ${variant.stale && html` <span class="mark stale">stale</span> `}
                </span>
              </div>

              <div class="verbs">${VERBS.map((verb) => html` <span class="verb">${verb}</span> `)}</div>
            </div>
          `
        }
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

    #root .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    #root .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    #root .filter {
      height: 2.8rem;
      margin-bottom: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    #root .rail-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    #root .rail-row.on {
      gap: 0.4rem;
      background: ${PLATE};
    }

    #root .bar {
      height: 0.9rem;
      width: 60%;
      border-radius: 999px;
      background: ${LINE};
    }

    #root .bar.wide {
      width: 88%;
    }

    #root .rail-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    #root .rail-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    #root .stage {
      display: flex;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    #root .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 0 0 19rem;
      overflow: hidden;
    }

    #root .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 0 0 auto;
      padding: 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    #root .thumb.on {
      border-color: ${INK};
    }

    #root .thumb.faded {
      opacity: 0.32;
    }

    #root .thumb-pic {
      display: flex;
      align-items: center;
      height: 6.2rem;
      padding: 0 1rem;
      border: 1px solid transparent;
      border-radius: 0.3rem;
      background: ${GROUND};
      --mini-label: 0.95rem;
      --mini-number: 2.8rem;
      --mini-unit: 1.1rem;
      --mini-change: 1.05rem;
      --mini-gap: 0.2rem;
      --mini-gap-x: 0.4rem;
    }

    #root .thumb-pic.waiting {
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.7rem;
      border-style: dashed;
      border-color: ${LINE};
      background:
        repeating-linear-gradient(135deg, rgba(232, 230, 225, 0.028) 0 0.5rem, rgba(232, 230, 225, 0) 0.5rem 1rem),
        ${GROUND};
    }

    #root .thumb-pic.picked {
      border-color: ${ACCENT};
    }

    #root .waiting-name {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      font-size: 1.05rem;
      line-height: 1.3;
      color: ${INK};
    }

    #root .waiting-note {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      line-height: 1;
      color: ${MUTED};
    }

    #root .dots {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    #root .dot {
      width: 0.3rem;
      height: 0.3rem;
      border-radius: 999px;
      background: ${MUTED};
    }

    #root .dot:nth-child(2) {
      opacity: 0.6;
    }

    #root .dot:nth-child(3) {
      opacity: 0.3;
    }

    #root .thumb-foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.6rem;
    }

    #root .thumb-name {
      min-width: 0;
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    #root .thumb-name.picked {
      color: ${ACCENT};
    }

    #root .dim {
      opacity: 0.45;
    }

    #root .marks {
      display: flex;
      gap: 0.5rem;
      flex: 0 0 auto;
    }

    #root .mark {
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    #root .mark.chosen {
      color: ${ACCENT};
    }

    #root .mark.rejected {
      color: ${MUTED};
    }

    #root .mark.stale {
      padding: 0 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.2rem;
      color: ${MUTED};
    }

    #root .mini {
      display: flex;
      flex-direction: column;
      gap: var(--mini-gap);
    }

    #root .mini-row {
      display: flex;
      align-items: baseline;
      gap: var(--mini-gap-x);
    }

    #root .mini-label {
      font-size: var(--mini-label);
      color: ${MUTED};
    }

    #root .mini-number {
      font-size: var(--mini-number);
      line-height: 1;
      color: ${INK};
    }

    #root .mini-unit {
      font-size: var(--mini-unit);
      color: ${INK};
    }

    #root .mini-change {
      font-size: var(--mini-change);
      line-height: 1;
    }

    #root .large {
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

    #root .large-pic {
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

    #root .large-foot {
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
    }

    #root .large-name {
      font-size: 1.5rem;
    }

    #root .verbs {
      display: flex;
      gap: 0.8rem;
    }

    #root .verb {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }
  `,
});
