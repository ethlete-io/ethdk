import { css, drawing, html } from '@design-explore';
import { tiles } from './tiles';

const roundsNewestFirst = [...tiles.rounds].reverse();

const thumbRows: Record<string, number[][]> = {
  a: [[100], [56, 40], [28, 28, 40]],
  b: [[42, 54], [100], [66, 30]],
  c: [[100], [74, 22], [100]],
  d: [[62, 34], [100], [46, 50]],
  e: [[100], [100], [58, 38]],
  f: [[34, 62], [88], [100]],
  g: [[100], [48, 48], [72]],
  h: [[70, 26], [100], [40, 56]],
  i: [[100], [100], [100]],
  j: [[52, 44], [64], [100]],
  k: [[100], [36, 60], [82]],
  l: [[46, 50], [46, 50], [100]],
};

const frameRows = [
  [100, 62],
  [100, 48],
  [92, 70],
  [100, 54],
  [86, 66],
  [100, 44],
  [96, 72],
  [100, 58],
  [90, 50],
  [100, 66],
];

export default drawing({
  body: html`
    <div class="tc-a et-surface--dark et-color--brand">
      <aside class="tc-a__column et-surface--dark-elevated">
        <div class="tc-a__scroll">
          ${roundsNewestFirst.map(
            (round) => html`
              <section class="tc-a__round">
                <header class="tc-a__round-head">
                  <span class="tc-a__round-key">${round.key}</span>
                  <span class="tc-a__round-title">${round.title}</span>
                </header>
                ${tiles.variants
                  .filter((variant) => variant.round === round.key)
                  .map(
                    (variant) => html`
                      <button
                        class="tc-a__tile${variant.current && ' tc-a__tile--current'}${
                          variant.verdict === 'chosen' && ' tc-a__tile--chosen'
                        }${variant.verdict === 'rejected' && ' tc-a__tile--rejected'}"
                      >
                        <span class="tc-a__thumb">
                          ${(thumbRows[variant.key] ?? []).map(
                            (row) => html`
                              <span class="tc-a__thumb-row">
                                ${row.map((width) => html`<span class="tc-a__block" style="width: ${width}%"></span>`)}
                              </span>
                            `,
                          )}
                        </span>
                        <span class="tc-a__tile-name">${variant.name}</span>
                        <span class="tc-a__tile-tag">
                          ${variant.current && 'on screen'}${variant.verdict === 'chosen' && 'chosen'}
                        </span>
                      </button>
                    `,
                  )}
              </section>
            `,
          )}
        </div>
        <div class="tc-a__rail"><span class="tc-a__thumb-bar"></span></div>
      </aside>

      <div class="tc-a__canvas">
        <div class="tc-a__frame">
          <div class="tc-a__frame-header">
            <span class="tc-a__frame-glyph"></span>
          </div>
          <div class="tc-a__frame-rows">
            ${frameRows.map(
              (row) => html`
                <div class="tc-a__frame-row">
                  <span class="tc-a__frame-line" style="width: ${row[0]}%"></span>
                  <span class="tc-a__frame-line" style="width: ${row[1]}%"></span>
                  <span class="tc-a__frame-stage"></span>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: css`
    .tc-a {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 4.4rem;
      width: 26rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .tc-a button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .tc-a__round-key,
    .tc-a__round-title,
    .tc-a__tile-tag {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .tc-a__column {
      position: relative;
      min-width: 0;
      border-right: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      overflow: hidden;
    }
    .tc-a__scroll {
      display: grid;
      align-content: start;
      gap: 1.8rem;
      padding: 1.2rem 1.6rem 1.2rem 1rem;
    }
    .tc-a__round {
      display: grid;
      gap: 0.8rem;
    }
    .tc-a__round-head {
      display: grid;
      gap: 0.2rem;
      padding-bottom: 0.4rem;
      border-bottom: 0.1rem solid rgb(var(--et-surface-color-rgb) / 0.12);
    }
    .tc-a__round-key {
      color: var(--et-surface-color-muted-solid);
      text-transform: uppercase;
    }
    .tc-a__round-title {
      color: var(--et-surface-color-subtle-solid);
      line-height: 1.3;
    }
    .tc-a__tile {
      display: grid;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .tc-a__tile--rejected {
      opacity: 0.32;
    }
    .tc-a__tile--chosen {
      border-color: var(--et-theme-color-primary-solid);
    }
    .tc-a__tile--chosen .tc-a__tile-name,
    .tc-a__tile--chosen .tc-a__tile-tag {
      color: var(--et-theme-color-ink-solid);
    }
    .tc-a__tile--current {
      border-color: var(--et-surface-color-muted-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.1);
      box-shadow: 0 0 0 0.2rem rgb(var(--et-surface-color-rgb) / 0.14);
    }
    .tc-a__tile--current .tc-a__tile-name,
    .tc-a__tile--current .tc-a__tile-tag {
      color: var(--et-surface-color-solid);
    }
    .tc-a__thumb {
      display: grid;
      align-content: start;
      gap: 0.35rem;
      height: 5.4rem;
      padding: 0.4rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
      overflow: hidden;
    }
    .tc-a__thumb-row {
      display: flex;
      gap: 0.35rem;
    }
    .tc-a__block {
      height: 0.8rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .tc-a__tile--current .tc-a__block {
      background: rgb(var(--et-surface-color-rgb) / 0.32);
    }
    .tc-a__tile--chosen .tc-a__block {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .tc-a__tile-name {
      display: -webkit-box;
      height: 2.9rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .tc-a__tile-tag {
      height: 1.4rem;
      color: var(--et-surface-color-subtle-solid);
      white-space: nowrap;
      overflow: hidden;
    }
    .tc-a__rail {
      position: absolute;
      top: 1.2rem;
      right: 0.4rem;
      bottom: 1.2rem;
      width: 0.4rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.08);
    }
    .tc-a__thumb-bar {
      display: block;
      width: 100%;
      height: 64%;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.32);
    }
    .tc-a__canvas {
      position: relative;
      display: grid;
      justify-items: end;
      min-width: 0;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.04) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
      overflow: hidden;
    }
    .tc-a__frame {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: 3.2rem;
      height: 100%;
      border-left: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
    }
    .tc-a__frame-header {
      display: flex;
      align-items: center;
      height: 6.4rem;
      padding: 0 0.8rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .tc-a__frame-glyph {
      width: 2rem;
      height: 2rem;
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.3);
    }
    .tc-a__frame-rows {
      display: grid;
      align-content: start;
      gap: 1.6rem;
      padding: 1.6rem 0 1.6rem 0.8rem;
      overflow: hidden;
    }
    .tc-a__frame-row {
      display: grid;
      gap: 0.6rem;
      justify-items: start;
      width: 12rem;
      padding-bottom: 1.4rem;
      border-bottom: 0.1rem solid rgb(var(--et-surface-color-rgb) / 0.08);
    }
    .tc-a__frame-line {
      height: 1.1rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.16);
    }
    .tc-a__frame-stage {
      width: 8rem;
      height: 1.6rem;
      border-radius: 0.8rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.28);
    }
  `,
});
