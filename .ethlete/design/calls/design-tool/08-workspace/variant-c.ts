import { css, drawing, html } from '@design-explore';
import { workspace } from './workspace';

const current = workspace.variants.find((variant) => variant.current);

const thumbRows: Record<string, number[][]> = {
  a: [[100], [56, 40], [28, 28, 40]],
  b: [[42, 54], [100], [66, 30]],
  c: [[100], [74, 22], [100]],
  d: [[62, 34], [100], [46, 50]],
  e: [[100], [100], [58, 38]],
  f: [[34, 62], [88], [100]],
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
];

export default drawing({
  body: html`
    <div class="ws-c et-surface--dark et-color--brand">
      <aside class="ws-c__tiles et-surface--dark-elevated">
        ${workspace.call.rounds.map(
          (round) => html`
            <section class="ws-c__round-group">
              <header class="ws-c__round-head">${round}</header>
              ${workspace.variants
                .filter((variant) => variant.round === round)
                .map(
                  (variant) => html`
                    <button
                      class="ws-c__tile${variant.current && ' ws-c__tile--current'}${
                        variant.verdict === 'chosen' && ' ws-c__tile--chosen'
                      }${variant.verdict === 'rejected' && ' ws-c__tile--rejected'}"
                    >
                      <span class="ws-c__thumb">
                        ${(thumbRows[variant.key] ?? []).map(
                          (row) => html`
                            <span class="ws-c__thumb-row">
                              ${row.map((width) => html`<span class="ws-c__block" style="width: ${width}%"></span>`)}
                            </span>
                          `,
                        )}
                      </span>
                      <span class="ws-c__tile-name">${variant.name}</span>
                      ${variant.current && html`<span class="ws-c__tile-tag">on screen</span>`}
                      ${variant.verdict === 'chosen' && html`<span class="ws-c__tile-tag">chosen</span>`}
                    </button>
                  `,
                )}
            </section>
          `,
        )}
      </aside>

      <div class="ws-c__canvas">
        <div class="ws-c__frame">
          <div class="ws-c__frame-header">
            <span class="ws-c__frame-glyph"></span>
            <span class="ws-c__frame-heading"></span>
          </div>
          <div class="ws-c__frame-rows">
            ${frameRows.map(
              (row) => html`
                <div class="ws-c__frame-row">
                  <span class="ws-c__frame-line" style="width: ${row[0]}%"></span>
                  <span class="ws-c__frame-line" style="width: ${row[1]}%"></span>
                  <span class="ws-c__frame-stage"></span>
                </div>
              `,
            )}
          </div>
          <div class="ws-c__frame-tabs">${[0, 1, 2, 3].map(() => html`<span class="ws-c__frame-tab"></span>`)}</div>
        </div>

        <div class="ws-c__measure"><span>${workspace.call.frameWidth} px frame in a wider canvas</span></div>

        <div class="ws-c__float ws-c__float--top">
          <div class="ws-c__bar et-surface--dark-elevated">
            <span class="ws-c__eyebrow">${workspace.call.eyebrow}</span>
            <h2>${workspace.call.headline}</h2>
            <span class="ws-c__round">${workspace.call.round}</span>
          </div>
          <div class="ws-c__settled">
            <div class="ws-c__line et-surface--dark-elevated">
              <span class="ws-c__eyebrow">${workspace.call.eyebrow}</span>
              <span class="ws-c__line-text">${workspace.call.headline}</span>
            </div>
            <span class="ws-c__note">pointer away</span>
          </div>
        </div>

        <div class="ws-c__float ws-c__float--bottom">
          <div class="ws-c__settled">
            <div class="ws-c__line et-surface--dark-elevated">
              <span class="ws-c__line-strong">${current?.name}</span>
              <span class="ws-c__line-text"><i class="ws-c__dot"></i>${workspace.check}</span>
            </div>
            <span class="ws-c__note">pointer away</span>
          </div>
          <div class="ws-c__bar et-surface--dark-elevated">
            <div class="ws-c__option">
              <b>${current?.name}</b>
              <span class="ws-c__check"><i class="ws-c__dot"></i>${workspace.check}</span>
              <span class="ws-c__address">${workspace.address}</span>
            </div>
            <p class="ws-c__claim"><span class="ws-c__tag">claims</span>${workspace.claim}</p>
            <p class="ws-c__cost"><span class="ws-c__tag">costs</span>${workspace.cost}</p>
            <div class="ws-c__verbs">
              ${workspace.verbs.map(
                (verb) => html`
                  <button class="ws-c__verb${verb === 'Accept' && ' ws-c__verb--primary'}">${verb}</button>
                `,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: css`
    .ws-c {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      width: 72rem;
      height: 90rem;
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .ws-c button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ws-c__eyebrow,
    .ws-c__address,
    .ws-c__note,
    .ws-c__tag,
    .ws-c__round-head,
    .ws-c__tile-tag,
    .ws-c__measure span {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .ws-c__tiles {
      display: grid;
      align-content: start;
      gap: 1.8rem;
      min-height: 0;
      padding: 1.2rem 1rem;
      border-right: 0.1rem solid var(--et-surface-border);
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      overflow: hidden;
    }
    .ws-c__round-group {
      display: grid;
      gap: 0.8rem;
    }
    .ws-c__round-head {
      color: var(--et-surface-text-subtle);
      text-transform: uppercase;
    }
    .ws-c__tile {
      display: grid;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      text-align: left;
    }
    .ws-c__tile--rejected {
      opacity: 0.32;
    }
    .ws-c__tile--chosen {
      border-color: var(--et-tone-fill);
    }
    .ws-c__tile--chosen .ws-c__tile-name,
    .ws-c__tile--chosen .ws-c__tile-tag {
      color: var(--et-tone-text);
    }
    .ws-c__tile--current {
      border-color: var(--et-surface-text-muted);
      background: color-mix(in srgb, var(--et-surface-text) 10%, transparent);
      box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--et-surface-text) 14%, transparent);
    }
    .ws-c__tile--current .ws-c__tile-name {
      color: var(--et-surface-text);
    }
    .ws-c__thumb {
      display: grid;
      align-content: start;
      gap: 0.35rem;
      height: 5rem;
      padding: 0.4rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background);
      box-shadow: inset 0 0 0 0.1rem color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      overflow: hidden;
    }
    .ws-c__thumb-row {
      display: flex;
      gap: 0.35rem;
    }
    .ws-c__block {
      height: 0.7rem;
      border-radius: 0.1rem;
      background: color-mix(in srgb, var(--et-surface-text) 18%, transparent);
    }
    .ws-c__tile--current .ws-c__block {
      background: color-mix(in srgb, var(--et-surface-text) 32%, transparent);
    }
    .ws-c__tile--chosen .ws-c__block {
      background: color-mix(in srgb, var(--et-tone-fill) 35%, transparent);
    }
    .ws-c__tile-name {
      color: var(--et-surface-text-muted);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .ws-c__tile-tag {
      color: var(--et-surface-text-subtle);
    }
    .ws-c__canvas {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 0;
      background:
        repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--et-surface-text) 4%, transparent) 0 0.1rem,
          transparent 0.1rem 1.4rem
        ),
        color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      overflow: hidden;
    }
    .ws-c__frame {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 39rem;
      height: 100%;
      border-inline: 0.1rem solid var(--et-surface-border);
      background: var(--et-surface-background);
    }
    .ws-c__frame-header {
      display: flex;
      gap: 1rem;
      align-items: center;
      height: 6.4rem;
      padding: 0 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border);
    }
    .ws-c__frame-glyph {
      width: 2rem;
      height: 2rem;
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-surface-text) 30%, transparent);
    }
    .ws-c__frame-heading {
      width: 16rem;
      height: 1.4rem;
      border-radius: 0.2rem;
      background: color-mix(in srgb, var(--et-surface-text) 30%, transparent);
    }
    .ws-c__frame-rows {
      display: grid;
      align-content: start;
      gap: 1.6rem;
      padding: 1.6rem;
      overflow: hidden;
    }
    .ws-c__frame-row {
      display: grid;
      gap: 0.6rem;
      justify-items: start;
      padding-bottom: 1.4rem;
      border-bottom: 0.1rem solid color-mix(in srgb, var(--et-surface-text) 8%, transparent);
    }
    .ws-c__frame-line {
      height: 1.1rem;
      border-radius: 0.2rem;
      background: color-mix(in srgb, var(--et-surface-text) 16%, transparent);
    }
    .ws-c__frame-stage {
      width: 8rem;
      height: 1.6rem;
      border-radius: 0.8rem;
      background: color-mix(in srgb, var(--et-tone-fill) 28%, transparent);
    }
    .ws-c__frame-tabs {
      display: flex;
      gap: 3.2rem;
      align-items: center;
      justify-content: center;
      height: 6.4rem;
      border-top: 0.1rem solid var(--et-surface-border);
    }
    .ws-c__frame-tab {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--et-surface-text) 30%, transparent);
    }
    .ws-c__measure {
      position: absolute;
      top: 50%;
      left: 50%;
      display: grid;
      justify-items: center;
      width: 39rem;
      height: 1.2rem;
      transform: translate(-50%, -50%);
      border-top: 0.1rem dashed color-mix(in srgb, var(--et-surface-text) 35%, transparent);
      border-inline: 0.1rem dashed color-mix(in srgb, var(--et-surface-text) 35%, transparent);
    }
    .ws-c__measure span {
      padding: 0 0.6rem;
      background: var(--et-surface-background);
      color: var(--et-surface-text-subtle);
      transform: translateY(-0.7rem);
    }
    .ws-c__float {
      position: absolute;
      inset-inline: 0;
      display: grid;
      gap: 1rem;
      padding: 0;
    }
    .ws-c__float--top {
      top: 0;
    }
    .ws-c__float--bottom {
      bottom: 0;
    }
    .ws-c__bar {
      display: grid;
      gap: 0.5rem;
      padding: 1.4rem 1.8rem;
      border-block: 0.1rem solid color-mix(in srgb, var(--et-surface-text) 12%, transparent);
      background: color-mix(in srgb, var(--et-surface-background) 62%, transparent);
      color: var(--et-surface-text);
      backdrop-filter: blur(1rem);
    }
    .ws-c__float--top .ws-c__bar {
      border-top: 0;
    }
    .ws-c__float--bottom .ws-c__bar {
      border-bottom: 0;
    }
    .ws-c__bar h2 {
      margin: 0;
      font:
        500 1.9rem/1.25 'Jost',
        system-ui,
        sans-serif;
    }
    .ws-c__eyebrow,
    .ws-c__round {
      color: var(--et-surface-text-subtle);
    }
    .ws-c__round {
      font-size: 1.2rem;
    }
    .ws-c__settled {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0 1.8rem;
    }
    .ws-c__line {
      display: flex;
      flex: 1;
      gap: 0.8rem;
      align-items: center;
      min-width: 0;
      height: 2.6rem;
      padding: 0 1rem;
      border: 0.1rem solid color-mix(in srgb, var(--et-surface-text) 12%, transparent);
      border-radius: 1.3rem;
      background: color-mix(in srgb, var(--et-surface-background) 62%, transparent);
      color: var(--et-surface-text);
      backdrop-filter: blur(1rem);
    }
    .ws-c__line-text {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      min-width: 0;
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ws-c__line-strong {
      color: var(--et-surface-text);
      font-weight: 500;
      font-size: 1.2rem;
      white-space: nowrap;
    }
    .ws-c__note {
      padding: 0.2rem 0.6rem;
      border: 0.1rem dashed color-mix(in srgb, var(--et-tone-fill) 50%, transparent);
      border-radius: 0.3rem;
      color: var(--et-tone-text);
      white-space: nowrap;
    }
    .ws-c__option {
      display: flex;
      gap: 1.2rem;
      align-items: baseline;
      min-width: 0;
    }
    .ws-c__option b {
      font-weight: 500;
      font-size: 1.4rem;
      white-space: nowrap;
    }
    .ws-c__check {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
      white-space: nowrap;
    }
    .ws-c__dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-tone-fill);
    }
    .ws-c__address {
      flex: 1;
      color: var(--et-surface-text-subtle);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ws-c__claim,
    .ws-c__cost {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      margin: 0;
      color: var(--et-surface-text-muted);
      font-size: 1.3rem;
      line-height: 1.4;
    }
    .ws-c__tag {
      flex: none;
      width: 4.4rem;
      color: var(--et-surface-text-subtle);
      text-transform: uppercase;
    }
    .ws-c__verbs {
      display: flex;
      gap: 0.8rem;
      padding-top: 0.4rem;
    }
    .ws-c__verb {
      padding: 0.7rem 1.4rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-surface-text) 6%, transparent);
      color: var(--et-surface-text-muted);
      font-size: 1.3rem;
    }
    .ws-c__verb--primary {
      border-color: transparent;
      background: var(--et-tone-fill);
      color: var(--et-tone-on-fill);
      font-weight: 500;
    }
  `,
});
