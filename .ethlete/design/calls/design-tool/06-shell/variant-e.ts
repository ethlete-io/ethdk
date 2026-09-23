import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const current = shell.call.variants.find((variant) => variant.verdict !== 'rejected');

const thumbRows: Record<string, number[][]> = {
  a: [[100], [62, 34], [44, 52]],
  b: [[46, 50], [100], [30, 30, 34]],
  c: [[100], [72, 24], [100]],
};

export default drawing({
  body: html`
    <div class="shell-e et-surface--dark et-color--brand">
      <div class="shell-e__bar shell-e__bar--explorer">
        <h1>${shell.project}</h1>
        <button class="shell-e__control">
          Projects
          <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
        </button>
      </div>

      <div class="shell-e__bar shell-e__bar--workspace">
        <span class="shell-e__mono">${shell.checkout}</span>
        <button class="shell-e__control">
          <svg viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 1 1-2.4-5.7" />
            <path d="M20 4v4h-4" />
          </svg>
          Reload
        </button>
      </div>

      <div class="shell-e__bar shell-e__bar--chat">
        <span class="shell-e__mono">${shell.server}</span>
      </div>

      <aside class="shell-e__explorer">
        <div class="shell-e__search">
          <svg viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <span>Search calls</span>
        </div>

        <div class="shell-e__groups">
          ${shell.features.map(
            (feature) => html`
              <section>
                <header class="shell-e__group-head"><b>${feature.name}</b><span>${feature.open} open</span></header>
                ${feature.calls.map(
                  (call) => html`
                    <article class="shell-e__call${call.open && ' shell-e__call--open'}">
                      <span class="shell-e__eyebrow">${call.eyebrow}</span>
                      <b>${call.headline}</b>
                      <span class="shell-e__settled">${call.settled}</span>
                    </article>
                  `,
                )}
              </section>
            `,
          )}
        </div>
      </aside>

      <main class="shell-e__workspace">
        <div class="shell-e__call-head">
          <span class="shell-e__eyebrow">${shell.call.eyebrow}</span>
          <h2>${shell.call.headline}</h2>
          <span class="shell-e__round">${shell.call.round}</span>
        </div>

        <div class="shell-e__stage">
          <div class="shell-e__tiles">
            ${shell.call.variants.map((variant) => {
              const [key, name] = variant.name.split(' · ');

              return html`
                <button
                  class="shell-e__tile${variant.key === current?.key && ' shell-e__tile--current'}${
                    variant.verdict === 'rejected' && ' shell-e__tile--rejected'
                  }"
                >
                  <span class="shell-e__thumb">
                    ${(thumbRows[variant.key] ?? []).map(
                      (row) => html`
                        <span class="shell-e__thumb-row">
                          ${row.map((width) => html`<i style="flex: 0 0 ${width}%"></i>`)}
                        </span>
                      `,
                    )}
                  </span>
                  <span class="shell-e__tile-name"><b>${key}</b>${name}</span>
                </button>
              `;
            })}
          </div>

          <div class="shell-e__canvas"><span>${current?.name}</span></div>
        </div>

        <div class="shell-e__option-line">
          <span class="shell-e__option-name">${current?.name}</span>
          <span class="shell-e__muted">not checked</span>
          <span class="shell-e__mono">design-tool / call 6 / ${current?.key}</span>
        </div>

        <div class="shell-e__verbs">
          ${shell.verbs.map(
            (verb) =>
              html`<button class="shell-e__verb${verb === 'Accept' && ' shell-e__verb--primary'}">${verb}</button>`,
          )}
        </div>
      </main>

      <aside class="shell-e__chat">
        <div class="shell-e__chat-empty"><p>${shell.chat}</p></div>

        <div class="shell-e__composer">
          <div class="shell-e__input">Ask for another take, or say what to change.</div>
          <div class="shell-e__composer-foot">
            <span class="shell-e__agent">${shell.agent}</span>
            <div class="shell-e__composer-buttons">
              <button class="shell-e__verb">Stop</button>
              <button class="shell-e__verb shell-e__verb--primary">Send</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: css`
    .shell-e {
      display: grid;
      grid-template-columns: 40rem minmax(0, 1fr) 36rem;
      grid-template-rows: 4.4rem minmax(0, 1fr);
      width: 144rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-e button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .shell-e svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .shell-e__mono,
    .shell-e__eyebrow,
    .shell-e__settled,
    .shell-e__agent {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shell-e__muted {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-e__bar {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      padding: 0 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.04);
    }
    .shell-e__bar--explorer,
    .shell-e__bar--workspace,
    .shell-e__explorer,
    .shell-e__workspace {
      border-right: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-e__bar--chat {
      justify-content: flex-end;
    }
    .shell-e__bar h1 {
      margin: 0;
      font:
        500 1.7rem/1.2 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-e__control {
      display: flex;
      flex: none;
      gap: 0.5rem;
      align-items: center;
      padding: 0.3rem 0.8rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.05);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-e__explorer {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
    }
    .shell-e__search {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      margin: 1.4rem 1.6rem;
      padding: 0.8rem 1rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-e__groups {
      display: grid;
      align-content: start;
      gap: 2.4rem;
      padding-bottom: 1.6rem;
      overflow: hidden;
    }
    .shell-e__group-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 1.6rem 0.8rem;
    }
    .shell-e__group-head b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-e__group-head span {
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
    }
    .shell-e__call {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1.6rem;
      border-left: 0.2rem solid transparent;
    }
    .shell-e__call b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .shell-e__call--open {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .shell-e__call--open b {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .shell-e__call--open .shell-e__eyebrow {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-e__workspace {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      min-height: 0;
      padding: 2rem 2.4rem 1.8rem;
    }
    .shell-e__call-head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1.6rem;
    }
    .shell-e__call-head h2 {
      margin: 0;
      max-width: 72rem;
      font:
        500 2.2rem/1.25 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-e__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }
    .shell-e__stage {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      gap: 1.6rem;
      min-height: 0;
    }
    .shell-e__tiles {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      overflow: hidden;
    }
    .shell-e__tile {
      display: grid;
      gap: 0.6rem;
      padding: 0.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .shell-e__tile--current {
      border-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.08);
    }
    .shell-e__tile--rejected {
      opacity: 0.32;
    }
    .shell-e__thumb {
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 6.4rem;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
    }
    .shell-e__thumb-row {
      display: flex;
      gap: 0.4rem;
    }
    .shell-e__thumb i {
      height: 0.9rem;
      border-radius: 0.15rem;
      background: rgb(var(--et-surface-color-rgb) / 0.16);
    }
    .shell-e__tile--current .shell-e__thumb i {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.42);
    }
    .shell-e__tile-name {
      display: block;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .shell-e__tile-name b {
      padding-right: 0.4rem;
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .shell-e__tile--current .shell-e__tile-name b {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-e__canvas {
      display: grid;
      place-items: center;
      min-height: 0;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.03) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .shell-e__canvas span {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.4rem;
    }
    .shell-e__option-line {
      display: flex;
      gap: 1.2rem;
      align-items: baseline;
      padding-top: 1.4rem;
    }
    .shell-e__option-name {
      font-size: 1.5rem;
    }
    .shell-e__verbs {
      display: flex;
      gap: 0.8rem;
      padding-top: 1.2rem;
    }
    .shell-e__verb {
      padding: 0.8rem 1.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
    }
    .shell-e__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .shell-e__chat {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      min-height: 0;
    }
    .shell-e__chat-empty {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 2.4rem;
    }
    .shell-e__chat-empty p {
      margin: 0;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      text-align: center;
    }
    .shell-e__composer {
      display: grid;
      gap: 1rem;
      padding: 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-e__input {
      min-height: 9rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-e__composer-foot {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-e__composer-buttons {
      display: flex;
      gap: 0.8rem;
    }
    .shell-e__composer-buttons .shell-e__verb {
      padding: 0.6rem 1.4rem;
      font-size: 1.3rem;
    }
  `,
});
