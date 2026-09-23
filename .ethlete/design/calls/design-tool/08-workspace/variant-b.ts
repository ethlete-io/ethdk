import { css, drawing, html } from '@design-explore';
import { workspace } from './workspace';

const STRIP_PX = 150;
const CANVAS_PX = 498;

const thumbRows: Record<string, number[][]> = {
  a: [[100], [56, 40], [28, 28, 40]],
  b: [[46, 50], [100], [66, 30]],
  c: [[100], [74, 22], [100]],
  d: [[62, 34], [100], [40, 56]],
  e: [[92], [58], [34, 22]],
  f: [[100], [48, 48], [72]],
};

const current = workspace.variants.find((variant) => variant.current);

export default drawing({
  body: html`
    <div class="ws-b et-surface--dark et-color--brand">
      <header class="ws-b__head">
        <span class="ws-b__eyebrow">${workspace.call.eyebrow}</span>
        <h1>${workspace.call.headline}</h1>
        <span class="ws-b__round">${workspace.call.round}</span>
      </header>

      <div class="ws-b__stage">
        <aside class="ws-b__strip">
          <div class="ws-b__tiles">
            ${workspace.call.rounds.map((round) => {
              const drawn = workspace.variants.filter((variant) => variant.round === round);

              return html`
                <section class="ws-b__round-group">
                  <header class="ws-b__round-head"><b>${round}</b><span>${drawn.length} drawn</span></header>
                  ${drawn.map(
                    (variant) => html`
                      <button
                        class="ws-b__tile${variant.current && ' ws-b__tile--current'}${
                          variant.verdict === 'chosen' && ' ws-b__tile--chosen'
                        }${variant.verdict === 'rejected' && ' ws-b__tile--rejected'}"
                      >
                        <span class="ws-b__thumb">
                          ${(thumbRows[variant.key] ?? []).map(
                            (row) => html`
                              <span class="ws-b__thumb-row">
                                ${row.map((width) => html`<span class="ws-b__block" style="width: ${width}%"></span>`)}
                              </span>
                            `,
                          )}
                          ${variant.verdict && html`<span class="ws-b__verdict">${variant.verdict}</span>`}
                          ${variant.current && html`<span class="ws-b__verdict ws-b__verdict--current">on screen</span>`}
                        </span>
                        <span class="ws-b__tile-name">${variant.name}</span>
                      </button>
                    `,
                  )}
                </section>
              `;
            })}
          </div>

          <div class="ws-b__verbs">
            ${workspace.verbs.map(
              (verb) => html`
                <button class="ws-b__verb${verb === 'Accept' && ' ws-b__verb--primary'}">${verb}</button>
              `,
            )}
          </div>

          <div class="ws-b__measure"><i></i><span>${STRIP_PX}px</span><i></i></div>
        </aside>

        <div class="ws-b__canvas">
          <span class="ws-b__canvas-width">canvas ${CANVAS_PX}px</span>

          <div class="ws-b__frame-measure"><i></i><span>${workspace.call.frameWidth}px</span><i></i></div>

          <div class="ws-b__frame">
            <div class="ws-b__frame-bar">
              <span class="ws-b__block" style="width: 34%"></span>
              <span class="ws-b__block ws-b__block--dim" style="width: 18%"></span>
            </div>

            <div class="ws-b__frame-list">
              ${[96, 72, 88, 64].map(
                (width) => html`
                  <div class="ws-b__frame-row">
                    <span class="ws-b__frame-lines">
                      <i style="width: 100%"></i>
                      <i style="width: ${width}%"></i>
                    </span>
                    <span class="ws-b__frame-chip"></span>
                  </div>
                `,
              )}
            </div>

            <div class="ws-b__frame-foot">
              <span class="ws-b__block ws-b__block--dim" style="width: 22%"></span>
              <span class="ws-b__block ws-b__block--dim" style="width: 22%"></span>
              <span class="ws-b__block ws-b__block--dim" style="width: 22%"></span>
            </div>
          </div>
        </div>
      </div>

      <footer class="ws-b__foot">
        <p class="ws-b__claim"><b>${current?.name}</b>${workspace.claim}</p>
        <p class="ws-b__cost">${workspace.cost}</p>
        <div class="ws-b__foot-line">
          <span class="ws-b__check"><i></i>${workspace.check}</span>
          <span class="ws-b__address">${workspace.address}</span>
        </div>
      </footer>
    </div>
  `,
  styles: css`
    .ws-b {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 72rem;
      min-height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .ws-b button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ws-b__eyebrow,
    .ws-b__address,
    .ws-b__canvas-width {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .ws-b__head {
      display: grid;
      gap: 0.5rem;
      padding: 2.4rem 2.8rem 1.6rem;
    }
    .ws-b__head h1 {
      margin: 0;
      font:
        500 1.9rem/1.3 'Jost',
        system-ui,
        sans-serif;
    }
    .ws-b__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }
    .ws-b__stage {
      display: grid;
      grid-template-columns: ${STRIP_PX / 10}rem minmax(0, 1fr);
      gap: 1.6rem;
      min-height: 0;
      padding: 0 2.8rem;
    }
    .ws-b__strip {
      display: grid;
      grid-template-rows: auto auto auto;
      align-content: start;
      gap: 1.2rem;
      min-width: 0;
    }
    .ws-b__tiles {
      display: grid;
      align-content: start;
      gap: 1.2rem;
    }
    .ws-b__round-group {
      display: grid;
      gap: 0.6rem;
    }
    .ws-b__round-head {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      justify-content: space-between;
    }
    .ws-b__round-head b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .ws-b__round-head span {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1rem;
    }
    .ws-b__tile {
      display: grid;
      gap: 0.45rem;
      padding: 0.5rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .ws-b__tile--rejected {
      opacity: 0.32;
    }
    .ws-b__tile--chosen {
      border-color: var(--et-theme-color-primary-solid);
    }
    .ws-b__tile--current {
      border-color: transparent;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.12);
      box-shadow: 0 0 0 0.2rem var(--et-theme-color-primary-solid);
    }
    .ws-b__thumb {
      position: relative;
      display: grid;
      align-content: start;
      gap: 0.35rem;
      height: 3rem;
      padding: 0.4rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
      overflow: hidden;
    }
    .ws-b__thumb-row {
      display: flex;
      gap: 0.3rem;
    }
    .ws-b__block {
      height: 0.5rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .ws-b__block--dim {
      background: rgb(var(--et-surface-color-rgb) / 0.1);
    }
    .ws-b__tile--current .ws-b__block,
    .ws-b__tile--chosen .ws-b__block {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .ws-b__verdict {
      position: absolute;
      right: 0.3rem;
      bottom: 0.3rem;
      padding: 0.1rem 0.4rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.12);
      color: var(--et-surface-color-muted-solid);
      font-size: 0.9rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .ws-b__tile--chosen .ws-b__verdict {
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
    }
    .ws-b__verdict--current {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.2);
      color: var(--et-theme-color-ink-solid);
    }
    .ws-b__tile-name {
      color: var(--et-surface-color-muted-solid);
      font-size: 1rem;
      line-height: 1.25;
    }
    .ws-b__tile--current .ws-b__tile-name,
    .ws-b__tile--chosen .ws-b__tile-name {
      color: var(--et-theme-color-ink-solid);
    }
    .ws-b__verbs {
      display: grid;
      gap: 0.5rem;
      padding-top: 1.2rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .ws-b__verb {
      padding: 0.6rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.25rem;
      text-align: center;
      white-space: nowrap;
    }
    .ws-b__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .ws-b__measure,
    .ws-b__frame-measure {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
    }
    .ws-b__measure i,
    .ws-b__frame-measure i {
      flex: 1;
      height: 0.1rem;
      background: rgb(var(--et-surface-color-rgb) / 0.2);
    }
    .ws-b__canvas {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      justify-items: center;
      gap: 0.8rem;
      min-height: 0;
      padding: 3.6rem 2.4rem 2.4rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.03) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .ws-b__canvas-width {
      position: absolute;
      top: 1.2rem;
      right: 1.4rem;
    }
    .ws-b__frame-measure {
      width: ${workspace.call.frameWidth / 10}rem;
    }
    .ws-b__frame {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 1.2rem;
      width: ${workspace.call.frameWidth / 10}rem;
      min-height: 0;
      padding: 1.4rem 1.2rem;
      border-radius: 0.6rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.12);
    }
    .ws-b__frame-bar,
    .ws-b__frame-foot {
      display: flex;
      gap: 0.8rem;
      align-items: center;
    }
    .ws-b__frame-bar .ws-b__block,
    .ws-b__frame-foot .ws-b__block {
      height: 0.9rem;
      border-radius: 0.2rem;
    }
    .ws-b__frame-foot {
      justify-content: space-between;
      padding-top: 1.2rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .ws-b__frame-list {
      display: grid;
      align-content: start;
      gap: 0.9rem;
      min-height: 0;
      overflow: hidden;
    }
    .ws-b__frame-row {
      display: grid;
      gap: 0.6rem;
      padding: 0.9rem 1rem;
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }
    .ws-b__frame-lines {
      display: grid;
      gap: 0.4rem;
    }
    .ws-b__frame-lines i {
      height: 0.7rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.22);
    }
    .ws-b__frame-chip {
      width: 8rem;
      height: 1.4rem;
      border-radius: 0.7rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.3);
    }
    .ws-b__foot {
      display: grid;
      gap: 0.8rem;
      padding: 1.6rem 2.8rem 2.4rem;
    }
    .ws-b__claim,
    .ws-b__cost {
      margin: 0;
    }
    .ws-b__claim {
      font-size: 1.35rem;
    }
    .ws-b__claim b {
      margin-right: 0.8rem;
      color: var(--et-theme-color-ink-solid);
      font-weight: 500;
    }
    .ws-b__cost {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .ws-b__foot-line {
      display: flex;
      gap: 1.6rem;
      align-items: baseline;
      justify-content: space-between;
    }
    .ws-b__check {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .ws-b__check i {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }
  `,
});
