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
      background: var(--et-surface-background);
      color: var(--et-surface-text);
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
      border-right: 0.1rem solid var(--et-surface-border);
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      overflow: hidden;
    }
    .tc-b__head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1rem;
      border-bottom: 0.1rem solid var(--et-surface-border);
    }
    .tc-b__eyebrow {
      color: var(--et-surface-text-subtle);
    }
    .tc-b__headline {
      margin: 0;
      color: var(--et-surface-text-muted);
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
      color: var(--et-surface-text-muted);
    }
    .tc-b__round-title {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-text-subtle);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tc-b__round-state {
      flex: none;
      padding: 0.1rem 0.5rem;
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--et-tone-fill) 18%, transparent);
      color: var(--et-tone-text);
    }
    .tc-b__tile {
      display: grid;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      text-align: left;
    }
    .tc-b__tile--rejected {
      opacity: 0.32;
    }
    .tc-b__tile--chosen {
      border-color: var(--et-tone-fill);
    }
    .tc-b__tile--chosen .tc-b__tile-name {
      color: var(--et-tone-text);
    }
    .tc-b__tile--current {
      border-color: var(--et-surface-text-muted);
      background: color-mix(in srgb, var(--et-surface-text) 10%, transparent);
      box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--et-surface-text) 14%, transparent);
    }
    .tc-b__tile--current .tc-b__tile-name {
      color: var(--et-surface-text);
    }
    .tc-b__thumb {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 5rem;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background);
      box-shadow: inset 0 0 0 0.1rem color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      overflow: hidden;
    }
    .tc-b__thumb-row {
      display: flex;
      gap: 0.4rem;
    }
    .tc-b__block {
      height: 0.7rem;
      border-radius: 0.1rem;
      background: color-mix(in srgb, var(--et-surface-text) 18%, transparent);
    }
    .tc-b__tile--current .tc-b__block {
      background: color-mix(in srgb, var(--et-surface-text) 32%, transparent);
    }
    .tc-b__tile--chosen .tc-b__block {
      background: color-mix(in srgb, var(--et-tone-fill) 35%, transparent);
    }
    .tc-b__tile-tag {
      position: absolute;
      top: 0.4rem;
      right: 0.4rem;
      padding: 0.1rem 0.4rem;
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--et-surface-text) 16%, transparent);
      color: var(--et-surface-text);
    }
    .tc-b__tile-tag--chosen {
      background: color-mix(in srgb, var(--et-tone-fill) 22%, transparent);
      color: var(--et-tone-text);
    }
    .tc-b__tile-name {
      display: block;
      min-height: 2.9rem;
      color: var(--et-surface-text-muted);
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
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
    }
    .tc-b__fold--open .tc-b__fold-line {
      background: color-mix(in srgb, var(--et-surface-text) 8%, transparent);
    }
    .tc-b__caret {
      flex: none;
      width: 0.6rem;
      height: 0.6rem;
      border-right: 0.15rem solid var(--et-surface-text-subtle);
      border-bottom: 0.15rem solid var(--et-surface-text-subtle);
      transform: translateY(-0.1rem) rotate(-45deg);
    }
    .tc-b__fold--open .tc-b__caret {
      transform: translateY(-0.2rem) rotate(45deg);
    }
    .tc-b__fold-title {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-text-subtle);
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
      border: 0.1rem solid color-mix(in srgb, var(--et-tone-fill) 45%, transparent);
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--et-tone-fill) 14%, transparent);
      color: var(--et-tone-text);
    }
    .tc-b__chip-key {
      font-style: normal;
      font-weight: 500;
    }
    .tc-b__chip-name {
      min-width: 0;
      color: color-mix(in srgb, var(--et-tone-text) 80%, transparent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tc-b__fold-body {
      display: grid;
      gap: 0.7rem;
      padding-left: 0.8rem;
      border-left: 0.1rem solid color-mix(in srgb, var(--et-tone-fill) 35%, transparent);
    }
    .tc-b__note {
      margin: 0;
      padding: 0.3rem 0.6rem;
      border: 0.1rem dashed color-mix(in srgb, var(--et-surface-text) 28%, transparent);
      border-radius: 0.3rem;
      color: var(--et-surface-text-subtle);
      text-align: center;
    }
    .tc-b__canvas {
      min-width: 0;
      background:
        repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--et-surface-text) 4%, transparent) 0 0.1rem,
          transparent 0.1rem 1.4rem
        ),
        color-mix(in srgb, var(--et-surface-text) 3%, transparent);
    }
  `,
});
