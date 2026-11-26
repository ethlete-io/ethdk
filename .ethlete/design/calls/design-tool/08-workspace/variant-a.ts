import { css, drawing, html } from '@design-explore';
import { workspace } from './workspace';

const current = workspace.variants.find((variant) => variant.current);

const thumbRows: Record<string, number[][]> = {
  a: [[100], [56, 40], [30, 30, 36]],
  b: [[44, 52], [100], [64, 32]],
  c: [[100], [72, 24], [100]],
  d: [[100], [38, 58], [86]],
  e: [[92], [54], [40, 26, 30]],
  f: [[68, 28], [82], [46, 50]],
};

export default drawing({
  body: html`
    <div class="ws-a et-surface--dark et-color--brand">
      <header class="ws-a__head et-surface--dark-elevated">
        <span class="ws-a__eyebrow">${workspace.call.eyebrow}</span>
        <h2 class="ws-a__headline">${workspace.call.headline}</h2>
        <span class="ws-a__round">${workspace.call.round}</span>
      </header>

      <div class="ws-a__stage">
        <div class="ws-a__tiles">
          ${workspace.variants.map((variant) => {
            const [key, name] = variant.name.split(' · ');

            return html`
              <button
                class="ws-a__tile${variant.current && ' ws-a__tile--current'}${
                  variant.verdict === 'chosen' && ' ws-a__tile--chosen'
                }${variant.verdict === 'rejected' && ' ws-a__tile--rejected'}"
              >
                <span class="ws-a__thumb">
                  ${(thumbRows[variant.key] ?? []).map(
                    (row) => html`
                      <span class="ws-a__thumb-row">
                        ${row.map((width) => html`<i style="flex: 0 0 ${width}%"></i>`)}
                      </span>
                    `,
                  )}
                </span>
                <span class="ws-a__tile-name"><b>${key}</b>${name}</span>
              </button>
            `;
          })}
        </div>

        <div class="ws-a__canvas">
          <span class="ws-a__canvas-mark">${workspace.call.frameWidth}px · ${workspace.call.mode}</span>

          <div class="ws-a__frame">
            <div class="ws-a__frame-bar">
              <i style="width: 34%"></i>
              <i style="width: 14%"></i>
            </div>

            <div class="ws-a__frame-row ws-a__frame-row--tall">
              <i style="width: 94%"></i>
              <i style="width: 58%"></i>
              <span class="ws-a__frame-chip"></span>
            </div>

            <div class="ws-a__frame-row"><i style="width: 72%"></i></div>
            <div class="ws-a__frame-row"><i style="width: 84%"></i></div>
            <div class="ws-a__frame-row"><i style="width: 66%"></i></div>
            <div class="ws-a__frame-row"><i style="width: 78%"></i></div>
          </div>
        </div>
      </div>

      <footer class="ws-a__foot et-surface--dark-elevated">
        <b class="ws-a__foot-name">${current?.name}</b>
        <span class="ws-a__check"><i class="ws-a__dot"></i>${workspace.check}</span>
        <span class="ws-a__address">${workspace.address}</span>
        <span class="ws-a__verbs">
          ${workspace.verbs.map(
            (verb) => html`<button class="ws-a__verb${verb === 'Accept' && ' ws-a__verb--primary'}">${verb}</button>`,
          )}
        </span>
      </footer>
    </div>
  `,
  styles: css`
    .ws-a {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 72rem;
      height: 90rem;
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .ws-a button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ws-a__head,
    .ws-a__foot {
      display: flex;
      gap: 1.2rem;
      align-items: baseline;
      padding: 1.3rem 2.4rem;
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      white-space: nowrap;
    }
    .ws-a__head {
      border-bottom: 0.1rem solid var(--et-surface-border);
    }
    .ws-a__foot {
      border-top: 0.1rem solid var(--et-surface-border);
    }
    .ws-a__eyebrow,
    .ws-a__address,
    .ws-a__canvas-mark {
      color: var(--et-surface-text-subtle);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .ws-a__headline {
      flex: 1;
      margin: 0;
      min-width: 0;
      overflow: hidden;
      font:
        500 1.6rem/1.3 'Jost',
        system-ui,
        sans-serif;
      text-overflow: ellipsis;
    }
    .ws-a__round {
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
    }
    .ws-a__stage {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      gap: 1.6rem;
      min-height: 0;
      padding: 2rem 2.4rem;
    }
    .ws-a__tiles {
      display: grid;
      align-content: start;
      gap: 0.8rem;
      min-height: 0;
    }
    .ws-a__tile {
      display: grid;
      position: relative;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.5rem;
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
      text-align: left;
    }
    .ws-a__tile--chosen {
      border-color: var(--et-tone-fill);
    }
    .ws-a__tile--chosen .ws-a__tile-name {
      color: var(--et-tone-text);
    }
    .ws-a__tile--rejected {
      opacity: 0.32;
    }
    .ws-a__tile--current {
      border-color: var(--et-surface-text-muted);
      background: color-mix(in srgb, var(--et-surface-text) 12%, transparent);
    }
    .ws-a__tile--current .ws-a__tile-name {
      color: var(--et-surface-text);
    }
    .ws-a__tile--current::after {
      position: absolute;
      top: 3.2rem;
      right: -0.9rem;
      width: 1rem;
      height: 1rem;
      border-top: 0.1rem solid var(--et-surface-text-muted);
      border-right: 0.1rem solid var(--et-surface-text-muted);
      background: var(--et-surface-background);
      transform: rotate(45deg);
      content: '';
    }
    .ws-a__thumb {
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 5.4rem;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background);
      box-shadow: inset 0 0 0 0.1rem color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      overflow: hidden;
    }
    .ws-a__thumb-row {
      display: flex;
      gap: 0.4rem;
    }
    .ws-a__thumb-row i {
      height: 0.7rem;
      border-radius: 0.1rem;
      background: color-mix(in srgb, var(--et-surface-text) 18%, transparent);
    }
    .ws-a__tile--current .ws-a__thumb-row i {
      background: color-mix(in srgb, var(--et-surface-text) 34%, transparent);
    }
    .ws-a__tile--chosen .ws-a__thumb-row i {
      background: color-mix(in srgb, var(--et-tone-fill) 40%, transparent);
    }
    .ws-a__tile-name {
      color: var(--et-surface-text-muted);
      font-size: 1rem;
      line-height: 1.3;
    }
    .ws-a__tile-name b {
      padding-right: 0.4rem;
      color: var(--et-surface-text);
      font-weight: 500;
    }
    .ws-a__canvas {
      display: grid;
      position: relative;
      place-items: center;
      min-height: 0;
      padding: 2.4rem 0;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 1.2rem;
      background:
        repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--et-surface-text) 3%, transparent) 0 0.1rem,
          transparent 0.1rem 1.4rem
        ),
        color-mix(in srgb, var(--et-surface-text) 3%, transparent);
    }
    .ws-a__canvas-mark {
      position: absolute;
      top: 0.8rem;
      right: 1.2rem;
    }
    .ws-a__frame {
      display: grid;
      align-content: start;
      gap: 0.8rem;
      width: 39rem;
      height: 100%;
      padding: 1.2rem;
      border-radius: 0.6rem;
      background: var(--et-surface-background);
      box-shadow: 0 0 0 0.1rem var(--et-surface-border);
      overflow: hidden;
    }
    .ws-a__frame-bar {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 1rem;
      border-bottom: 0.1rem solid var(--et-surface-border);
    }
    .ws-a__frame-bar i,
    .ws-a__frame-row i {
      height: 1rem;
      border-radius: 0.2rem;
      background: color-mix(in srgb, var(--et-surface-text) 14%, transparent);
    }
    .ws-a__frame-row {
      display: grid;
      gap: 0.6rem;
      justify-items: start;
      padding: 0.9rem 1rem;
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-surface-text) 4%, transparent);
    }
    .ws-a__frame-row--tall i {
      background: color-mix(in srgb, var(--et-surface-text) 26%, transparent);
    }
    .ws-a__frame-chip {
      width: 8rem;
      height: 1.6rem;
      border-radius: 0.8rem;
      background: color-mix(in srgb, var(--et-tone-fill) 22%, transparent);
    }
    .ws-a__foot-name {
      font-weight: 500;
      font-size: 1.3rem;
    }
    .ws-a__check {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
    }
    .ws-a__dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-tone-fill);
    }
    .ws-a__address {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ws-a__verbs {
      display: flex;
      gap: 0.6rem;
    }
    .ws-a__verb {
      padding: 0.5rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--et-surface-text) 4%, transparent);
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
    }
    .ws-a__verb--primary {
      border-color: transparent;
      background: var(--et-tone-fill);
      color: var(--et-tone-on-fill);
      font-weight: 500;
    }
  `,
});
