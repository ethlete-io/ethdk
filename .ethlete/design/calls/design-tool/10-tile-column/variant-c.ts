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
      background: var(--et-surface-background);
      color: var(--et-surface-text);
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
      border-right: 0.1rem solid var(--et-surface-border);
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      overflow: hidden;
    }
    .tc-c__stepper {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
      padding: 1.2rem 1rem 1.4rem;
      border-bottom: 0.1rem solid var(--et-surface-border);
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
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-surface-text) 6%, transparent);
      color: var(--et-surface-text-muted);
      font-size: 1.6rem;
      line-height: 1;
    }
    .tc-c__step--spent {
      border-color: color-mix(in srgb, var(--et-surface-text) 10%, transparent);
      background: none;
      color: var(--et-surface-text-subtle);
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
      color: var(--et-surface-text-subtle);
      text-transform: uppercase;
    }
    .tc-c__round-title {
      color: var(--et-surface-text);
      font-weight: 500;
      font-size: 1.3rem;
      line-height: 1.25;
    }
    .tc-c__mark {
      color: var(--et-surface-text-subtle);
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
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.6rem;
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      text-align: left;
    }
    .tc-c__tile--rejected {
      opacity: 0.32;
    }
    .tc-c__tile--chosen {
      border-color: var(--et-tone-fill);
    }
    .tc-c__tile--chosen .tc-c__name,
    .tc-c__tile--chosen .tc-c__tag {
      color: var(--et-tone-text);
    }
    .tc-c__tile--current {
      border-color: var(--et-surface-text-muted);
      background: color-mix(in srgb, var(--et-surface-text) 10%, transparent);
      box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--et-surface-text) 14%, transparent);
    }
    .tc-c__tile--current .tc-c__name {
      color: var(--et-surface-text);
    }
    .tc-c__thumb {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      padding: 0.8rem;
      border-radius: 0.4rem;
      background: var(--et-surface-background);
      box-shadow: inset 0 0 0 0.1rem color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      overflow: hidden;
    }
    .tc-c__thumb-bar {
      width: 40%;
      height: 0.9rem;
      margin-bottom: 0.4rem;
      border-radius: 0.2rem;
      background: color-mix(in srgb, var(--et-surface-text) 28%, transparent);
    }
    .tc-c__mock {
      display: grid;
      gap: 0.6rem;
      padding-bottom: 0.9rem;
      border-bottom: 0.1rem solid color-mix(in srgb, var(--et-surface-text) 8%, transparent);
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
      background: color-mix(in srgb, var(--et-surface-text) 5%, transparent);
    }
    .tc-c__line {
      height: 0.9rem;
      border-radius: 0.2rem;
      background: color-mix(in srgb, var(--et-surface-text) 18%, transparent);
    }
    .tc-c__tile--current .tc-c__line {
      background: color-mix(in srgb, var(--et-surface-text) 32%, transparent);
    }
    .tc-c__tile--chosen .tc-c__line {
      background: color-mix(in srgb, var(--et-tone-fill) 35%, transparent);
    }
    .tc-c__chip {
      width: 6.4rem;
      height: 1.4rem;
      border-radius: 0.7rem;
      background: color-mix(in srgb, var(--et-tone-fill) 28%, transparent);
    }
    .tc-c__mock--split .tc-c__chip {
      width: 100%;
    }
    .tc-c__glyph {
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-tone-fill) 28%, transparent);
    }
    .tc-c__foot {
      display: grid;
      gap: 0.3rem;
      justify-items: start;
    }
    .tc-c__name {
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
      line-height: 1.3;
    }
    .tc-c__tag {
      color: var(--et-surface-text-subtle);
    }
    .tc-c__canvas {
      position: relative;
      background:
        repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--et-surface-text) 4%, transparent) 0 0.1rem,
          transparent 0.1rem 1.4rem
        ),
        color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      overflow: hidden;
    }
    .tc-c__canvas-edge {
      position: absolute;
      inset-block: 0;
      right: 0;
      width: 1.4rem;
      border-left: 0.1rem solid var(--et-surface-border);
      background: var(--et-surface-background);
    }
  `,
});
