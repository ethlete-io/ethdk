import { css, drawing, html } from '@design-explore';
import { Tile, tiles } from './tiles';

const thumbRows: Record<string, number[][]> = {
  a: [[100], [56, 40], [28, 28, 40]],
  b: [[42, 54], [100], [66, 30]],
  c: [[100], [74, 22], [100]],
  d: [[62, 34], [100], [46, 50]],
  e: [[100], [100], [58, 38]],
  f: [[34, 62], [88], [100]],
  g: [[100], [48, 48], [72, 24]],
  h: [[82, 14], [100], [38, 58]],
  i: [[100], [64, 32], [100]],
  j: [[54, 42], [100], [26, 70]],
  k: [[100], [36, 60], [92]],
  l: [[70, 26], [44, 52], [100]],
};

const variantsOf = (round: string) => tiles.variants.filter((variant) => variant.round === round);
const winnerOf = (round: string) => variantsOf(round).find((variant) => variant.verdict === 'chosen');

const openRound = tiles.rounds.find((round) => variantsOf(round.key).some((variant) => !variant.verdict));
const settledRounds = tiles.rounds.filter((round) => round !== openRound).reverse();
const openedFold = settledRounds[0];

const nameTail = (name: string) => name.split(' · ')[1] ?? name;

const tile = (variant: Tile) => html`
  <div
    class="tc-b__tile${variant.verdict === 'chosen' && ' tc-b__tile--chosen'}${
      variant.verdict === 'rejected' && ' tc-b__tile--rejected'
    }${variant.current && ' tc-b__tile--current'}"
  >
    <span class="tc-b__thumb">
      ${(thumbRows[variant.key] ?? []).map(
        (row) => html`
          <span class="tc-b__thumb-row">
            ${row.map((width) => html`<span class="tc-b__block" style="width: ${width}%"></span>`)}
          </span>
        `,
      )}
      ${variant.current && html`<span class="tc-b__tile-tag">on screen</span>`}
      ${variant.verdict === 'chosen' && html`<span class="tc-b__tile-tag tc-b__tile-tag--chosen">chosen</span>`}
    </span>
    <span class="tc-b__tile-name">${variant.name}</span>
  </div>
`;

export default drawing({
  body: html`
    <div class="tc-b et-surface--dark et-color--brand">
      <aside class="tc-b__column et-surface--dark-elevated">
        <header class="tc-b__head">
          <span class="tc-b__eyebrow">${tiles.call.eyebrow}</span>
          <p class="tc-b__headline">${tiles.call.headline}</p>
        </header>

        <section class="tc-b__open">
          <header class="tc-b__round-head">
            <span class="tc-b__round-key">${openRound?.key}</span>
            <span class="tc-b__round-title">${openRound?.title}</span>
            <span class="tc-b__round-state">open</span>
          </header>
          ${variantsOf(openRound?.key ?? '').map(tile)}
        </section>

        <section class="tc-b__settled">
          ${settledRounds.map(
            (round) => html`
              <div class="tc-b__fold${round === openedFold && ' tc-b__fold--open'}">
                <button class="tc-b__fold-line">
                  <span class="tc-b__caret"></span>
                  <span class="tc-b__round-key">${round.key}</span>
                  <span class="tc-b__fold-title">${round.title}</span>
                  <span class="tc-b__chip">
                    <i class="tc-b__chip-key">${winnerOf(round.key)?.key}</i>
                    <span class="tc-b__chip-name">${nameTail(winnerOf(round.key)?.name ?? '')}</span>
                  </span>
                </button>
                ${round === openedFold && html`<div class="tc-b__fold-body">${variantsOf(round.key).map(tile)}</div>`}
              </div>
            `,
          )}
        </section>

        <p class="tc-b__note">the column ends here · nothing scrolls</p>
      </aside>

      <div class="tc-b__canvas"></div>
    </div>
  `,
  styles: css`
    .tc-b {
      display: grid;
      grid-template-columns: 22.4rem minmax(0, 1fr);
      width: 26rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .tc-b button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .tc-b__eyebrow,
    .tc-b__round-key,
    .tc-b__round-title,
    .tc-b__round-state,
    .tc-b__fold-title,
    .tc-b__tile-tag,
    .tc-b__chip,
    .tc-b__note {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .tc-b__column {
      display: grid;
      align-content: start;
      gap: 1.4rem;
      min-height: 0;
      padding: 1rem 0.9rem;
      border-right: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      overflow: hidden;
    }
    .tc-b__head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .tc-b__eyebrow {
      color: var(--et-surface-color-subtle-solid);
    }
    .tc-b__headline {
      margin: 0;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
      line-height: 1.3;
    }
    .tc-b__open {
      display: grid;
      gap: 0.7rem;
    }
    .tc-b__round-head {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      min-width: 0;
    }
    .tc-b__round-key,
    .tc-b__chip-key {
      flex: none;
      text-transform: uppercase;
    }
    .tc-b__round-key {
      color: var(--et-surface-color-muted-solid);
    }
    .tc-b__round-title {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-color-subtle-solid);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tc-b__round-state {
      flex: none;
      padding: 0.1rem 0.5rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.18);
      color: var(--et-theme-color-ink-solid);
    }
    .tc-b__tile {
      display: grid;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .tc-b__tile--rejected {
      opacity: 0.32;
    }
    .tc-b__tile--chosen {
      border-color: var(--et-theme-color-primary-solid);
    }
    .tc-b__tile--chosen .tc-b__tile-name {
      color: var(--et-theme-color-ink-solid);
    }
    .tc-b__tile--current {
      border-color: var(--et-surface-color-muted-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.1);
      box-shadow: 0 0 0 0.2rem rgb(var(--et-surface-color-rgb) / 0.14);
    }
    .tc-b__tile--current .tc-b__tile-name {
      color: var(--et-surface-color-solid);
    }
    .tc-b__thumb {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 5rem;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
      overflow: hidden;
    }
    .tc-b__thumb-row {
      display: flex;
      gap: 0.4rem;
    }
    .tc-b__block {
      height: 0.7rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .tc-b__tile--current .tc-b__block {
      background: rgb(var(--et-surface-color-rgb) / 0.32);
    }
    .tc-b__tile--chosen .tc-b__block {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .tc-b__tile-tag {
      position: absolute;
      top: 0.4rem;
      right: 0.4rem;
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.16);
      color: var(--et-surface-color-solid);
    }
    .tc-b__tile-tag--chosen {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.22);
      color: var(--et-theme-color-ink-solid);
    }
    .tc-b__tile-name {
      display: block;
      min-height: 2.9rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .tc-b__settled {
      display: grid;
      gap: 0.6rem;
    }
    .tc-b__fold {
      display: grid;
      gap: 0.7rem;
    }
    .tc-b__fold-line {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      min-width: 0;
      padding: 0.8rem 0.7rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .tc-b__fold--open .tc-b__fold-line {
      background: rgb(var(--et-surface-color-rgb) / 0.08);
    }
    .tc-b__caret {
      flex: none;
      width: 0.6rem;
      height: 0.6rem;
      border-right: 0.15rem solid var(--et-surface-color-subtle-solid);
      border-bottom: 0.15rem solid var(--et-surface-color-subtle-solid);
      transform: translateY(-0.1rem) rotate(-45deg);
    }
    .tc-b__fold--open .tc-b__caret {
      transform: translateY(-0.2rem) rotate(45deg);
    }
    .tc-b__fold-title {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-color-subtle-solid);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tc-b__chip {
      display: flex;
      flex: none;
      gap: 0.4rem;
      align-items: center;
      max-width: 8.4rem;
      padding: 0.2rem 0.5rem;
      border: 0.1rem solid rgb(var(--et-theme-color-primary-rgb) / 0.45);
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.14);
      color: var(--et-theme-color-ink-solid);
    }
    .tc-b__chip-key {
      font-style: normal;
      font-weight: 500;
    }
    .tc-b__chip-name {
      min-width: 0;
      color: rgb(var(--et-theme-color-ink-rgb) / 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tc-b__fold-body {
      display: grid;
      gap: 0.7rem;
      padding-left: 0.8rem;
      border-left: 0.1rem solid rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .tc-b__note {
      margin: 0;
      padding: 0.3rem 0.6rem;
      border: 0.1rem dashed rgb(var(--et-surface-color-rgb) / 0.28);
      border-radius: 0.3rem;
      color: var(--et-surface-color-subtle-solid);
      text-align: center;
    }
    .tc-b__canvas {
      min-width: 0;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.04) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
    }
  `,
});
