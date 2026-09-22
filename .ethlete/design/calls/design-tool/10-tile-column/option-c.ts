import { css, drawing, html } from '@design-explore';
import { tiles } from './tiles';

const current = tiles.variants.find((variant) => variant.current);
const roundIndex = tiles.rounds.findIndex((round) => round.key === current?.round);
const round = tiles.rounds[roundIndex];
const shown = tiles.variants.filter((variant) => variant.round === round?.key);

const leads = [92, 74, 86, 68];

const mockRow = (key: string, lead: number) => {
  if (key === 'j') {
    return html`
      <span class="tc-c__mock tc-c__mock--stack">
        <span class="tc-c__line" style="width: ${lead}%"></span>
        <span class="tc-c__chip"></span>
      </span>
    `;
  }

  if (key === 'k') {
    return html`
      <span class="tc-c__mock tc-c__mock--inline">
        <span class="tc-c__line" style="width: ${lead}%"></span>
        <span class="tc-c__glyph"></span>
      </span>
    `;
  }

  return html`
    <span class="tc-c__mock tc-c__mock--split">
      <span class="tc-c__half"><span class="tc-c__line" style="width: ${lead}%"></span></span>
      <span class="tc-c__half"><span class="tc-c__chip"></span></span>
    </span>
  `;
};

export default drawing({
  body: html`
    <div class="tc-c et-surface--dark et-color--brand">
      <aside class="tc-c__column et-surface--dark-elevated">
        <header class="tc-c__stepper">
          <div class="tc-c__walk">
            <button class="tc-c__step" aria-label="Previous round">‹</button>
            <span class="tc-c__round">
              <span class="tc-c__round-key">${round?.key}</span>
              <span class="tc-c__round-title">${round?.title}</span>
            </span>
            <button class="tc-c__step tc-c__step--spent" aria-label="Next round">›</button>
          </div>
          <span class="tc-c__mark">${roundIndex + 1} of ${tiles.rounds.length}</span>
        </header>

        <div class="tc-c__tiles">
          ${shown.map(
            (variant) => html`
              <button
                class="tc-c__tile${variant.current && ' tc-c__tile--current'}${
                  variant.verdict === 'chosen' && ' tc-c__tile--chosen'
                }${variant.verdict === 'rejected' && ' tc-c__tile--rejected'}"
              >
                <span class="tc-c__thumb">
                  <span class="tc-c__thumb-bar"></span>
                  ${leads.map((lead) => mockRow(variant.key, lead))}
                </span>
                <span class="tc-c__foot">
                  <span class="tc-c__name">${variant.name}</span>
                  ${variant.current && html`<span class="tc-c__tag">on screen</span>`}
                  ${variant.verdict === 'chosen' && html`<span class="tc-c__tag">chosen</span>`}
                </span>
              </button>
            `,
          )}
        </div>
      </aside>

      <div class="tc-c__canvas"><span class="tc-c__canvas-edge"></span></div>
    </div>
  `,
  styles: css`
    .tc-c {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 4.2rem;
      width: 26rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .tc-c button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .tc-c__round-key,
    .tc-c__mark,
    .tc-c__tag {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .tc-c__column {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
      border-right: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      overflow: hidden;
    }
    .tc-c__stepper {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      padding: 1.2rem 1rem 1.4rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .tc-c__walk {
      display: grid;
      grid-template-columns: 2.4rem minmax(0, 1fr) 2.4rem;
      gap: 0.6rem;
      align-items: center;
      width: 100%;
    }
    .tc-c__step {
      display: grid;
      place-items: center;
      height: 2.4rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.06);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.6rem;
      line-height: 1;
    }
    .tc-c__step--spent {
      border-color: rgb(var(--et-surface-color-rgb) / 0.1);
      background: none;
      color: var(--et-surface-color-subtle-solid);
      opacity: 0.4;
    }
    .tc-c__round {
      display: grid;
      gap: 0.2rem;
      justify-items: center;
      min-width: 0;
      text-align: center;
    }
    .tc-c__round-key {
      color: var(--et-surface-color-subtle-solid);
      text-transform: uppercase;
    }
    .tc-c__round-title {
      color: var(--et-surface-color-solid);
      font-weight: 500;
      font-size: 1.3rem;
      line-height: 1.25;
    }
    .tc-c__mark {
      color: var(--et-surface-color-subtle-solid);
    }
    .tc-c__tiles {
      display: grid;
      grid-template-rows: repeat(3, minmax(0, 1fr));
      gap: 1.2rem;
      min-height: 0;
      padding: 1.2rem 1rem;
    }
    .tc-c__tile {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 0.8rem;
      min-height: 0;
      padding: 0.8rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .tc-c__tile--rejected {
      opacity: 0.32;
    }
    .tc-c__tile--chosen {
      border-color: var(--et-theme-color-primary-solid);
    }
    .tc-c__tile--chosen .tc-c__name,
    .tc-c__tile--chosen .tc-c__tag {
      color: var(--et-theme-color-ink-solid);
    }
    .tc-c__tile--current {
      border-color: var(--et-surface-color-muted-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.1);
      box-shadow: 0 0 0 0.2rem rgb(var(--et-surface-color-rgb) / 0.14);
    }
    .tc-c__tile--current .tc-c__name {
      color: var(--et-surface-color-solid);
    }
    .tc-c__thumb {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      padding: 0.8rem;
      border-radius: 0.4rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
      overflow: hidden;
    }
    .tc-c__thumb-bar {
      width: 40%;
      height: 0.9rem;
      margin-bottom: 0.4rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.28);
    }
    .tc-c__mock {
      display: grid;
      gap: 0.6rem;
      padding-bottom: 0.9rem;
      border-bottom: 0.1rem solid rgb(var(--et-surface-color-rgb) / 0.08);
    }
    .tc-c__mock--inline {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.8rem;
      align-items: center;
    }
    .tc-c__mock--split {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.8rem;
      align-items: center;
    }
    .tc-c__half {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
      min-width: 0;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }
    .tc-c__line {
      height: 0.9rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .tc-c__tile--current .tc-c__line {
      background: rgb(var(--et-surface-color-rgb) / 0.32);
    }
    .tc-c__tile--chosen .tc-c__line {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .tc-c__chip {
      width: 6.4rem;
      height: 1.4rem;
      border-radius: 0.7rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.28);
    }
    .tc-c__mock--split .tc-c__chip {
      width: 100%;
    }
    .tc-c__glyph {
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 0.4rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.28);
    }
    .tc-c__foot {
      display: grid;
      gap: 0.3rem;
      justify-items: start;
    }
    .tc-c__name {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
      line-height: 1.3;
    }
    .tc-c__tag {
      color: var(--et-surface-color-subtle-solid);
    }
    .tc-c__canvas {
      position: relative;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.04) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
      overflow: hidden;
    }
    .tc-c__canvas-edge {
      position: absolute;
      inset-block: 0;
      right: 0;
      width: 1.4rem;
      border-left: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
    }
  `,
});
