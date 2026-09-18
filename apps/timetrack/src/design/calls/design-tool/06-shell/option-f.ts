import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const current = shell.call.variants.find((variant) => variant.verdict !== 'rejected');

const thumbRows: Record<string, number[][]> = {
  a: [[100], [58, 38], [30, 30, 36]],
  b: [[44, 52], [100], [64, 32]],
  c: [[100], [72, 24], [100]],
};

export default drawing({
  body: html`
    <div class="shell-f et-surface--dark et-color--brand">
      <div class="shell-f__body">
        <aside class="shell-f__explorer et-surface--dark-elevated">
          <div class="shell-f__explorer-head">
            <div class="shell-f__project">
              <h1>${shell.project}</h1>
              <button class="shell-f__project-switch">
                Projects
                <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
              </button>
            </div>
            <div class="shell-f__search">
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
              <span>Search calls</span>
            </div>
          </div>

          <div class="shell-f__groups">
            ${shell.features.map(
              (feature) => html`
                <section class="shell-f__group">
                  <header class="shell-f__group-head"><b>${feature.name}</b><span>${feature.open} open</span></header>
                  ${feature.calls.map(
                    (call) => html`
                      <article class="shell-f__call${call.open && ' shell-f__call--open'}">
                        <span class="shell-f__eyebrow">${call.eyebrow}</span>
                        <b>${call.headline}</b>
                        <span class="shell-f__settled">${call.settled}</span>
                      </article>
                    `,
                  )}
                </section>
              `,
            )}
          </div>
        </aside>

        <main class="shell-f__workspace">
          <div class="shell-f__workspace-head">
            <span class="shell-f__eyebrow">${shell.call.eyebrow}</span>
            <h2>${shell.call.headline}</h2>
            <span class="shell-f__round">${shell.call.round}</span>
          </div>

          <div class="shell-f__stage">
            <div class="shell-f__tiles">
              ${shell.call.variants.map(
                (variant) => html`
                  <button
                    class="shell-f__tile${variant.key === current?.key && ' shell-f__tile--current'}${
                      variant.verdict === 'rejected' && ' shell-f__tile--rejected'
                    }"
                  >
                    <span class="shell-f__thumb">
                      ${(thumbRows[variant.key] ?? []).map(
                        (row) => html`
                          <span class="shell-f__thumb-row">
                            ${row.map((width) => html`<span class="shell-f__block" style="width: ${width}%"></span>`)}
                          </span>
                        `,
                      )}
                    </span>
                    <span class="shell-f__tile-name">${variant.name}</span>
                  </button>
                `,
              )}
            </div>

            <div class="shell-f__canvas"><span>${current?.name}</span></div>
          </div>

          <div class="shell-f__option-line">
            <b>${current?.name}</b>
            <span>not checked</span>
            <span class="shell-f__address">/fifagg/competition-navigation/16/${current?.key}</span>
          </div>

          <div class="shell-f__verbs">
            ${shell.verbs.map(
              (verb) => html`
                <button class="shell-f__verb${verb === 'Accept' && ' shell-f__verb--primary'}">${verb}</button>
              `,
            )}
          </div>
        </main>

        <aside class="shell-f__chat et-surface--dark-elevated">
          <header class="shell-f__chat-head"><b>Chat</b><span>${shell.call.eyebrow}</span></header>

          <div class="shell-f__chat-empty"><p>${shell.chat}</p></div>

          <div class="shell-f__composer">
            <div class="shell-f__textarea">Ask for another take, or say what to change.</div>
            <div class="shell-f__composer-buttons">
              <button class="shell-f__verb">Stop</button>
              <button class="shell-f__verb shell-f__verb--primary">Send</button>
            </div>
          </div>
        </aside>
      </div>

      <footer class="shell-f__status">
        <span class="shell-f__status-item">${shell.checkout}</span>
        <button class="shell-f__reload">
          <svg viewBox="0 0 24 24">
            <path d="M20 12a8 8 0 1 1-2.4-5.7" />
            <path d="M20 4v4h-4" />
          </svg>
          Reload
        </button>
        <span class="shell-f__status-spacer"></span>
        <span class="shell-f__status-item"><i class="shell-f__dot"></i>${shell.server}</span>
        <span class="shell-f__status-item">${shell.agent}</span>
      </footer>
    </div>
  `,
  styles: css`
    .shell-f {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      width: 144rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-f button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .shell-f svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .shell-f__eyebrow,
    .shell-f__settled,
    .shell-f__address {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shell-f__body {
      display: grid;
      grid-template-columns: 40rem minmax(0, 1fr) 36rem;
      min-height: 0;
    }
    .shell-f__explorer,
    .shell-f__chat {
      display: grid;
      min-height: 0;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .shell-f__explorer {
      grid-template-rows: auto minmax(0, 1fr);
      border-right: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-f__chat {
      grid-template-rows: auto minmax(0, 1fr) auto;
      border-left: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-f__explorer-head {
      display: grid;
      gap: 1.4rem;
      padding: 2rem 1.6rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-f__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-f__project h1 {
      margin: 0;
      font:
        500 2.4rem/1.15 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-f__project-switch {
      display: flex;
      gap: 0.4rem;
      align-items: center;
      padding: 0.5rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-f__search {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0.8rem 1rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-f__groups {
      display: grid;
      align-content: start;
      gap: 2.4rem;
      padding: 1.6rem 0;
      overflow: hidden;
    }
    .shell-f__group-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 1.6rem 0.8rem;
    }
    .shell-f__group-head b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-f__group-head span {
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
    }
    .shell-f__call {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1.6rem;
      border-left: 0.2rem solid transparent;
    }
    .shell-f__call b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .shell-f__call--open {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .shell-f__call--open b {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .shell-f__call--open .shell-f__eyebrow {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-f__workspace {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      min-height: 0;
      padding: 2.4rem 3.2rem 2rem;
    }
    .shell-f__workspace-head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1.8rem;
    }
    .shell-f__workspace-head h2 {
      margin: 0;
      max-width: 72rem;
      font:
        500 2.2rem/1.25 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-f__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }
    .shell-f__stage {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      gap: 1.6rem;
      min-height: 0;
    }
    .shell-f__tiles {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      overflow: hidden;
    }
    .shell-f__tile {
      display: grid;
      gap: 0.6rem;
      padding: 0.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.03);
      text-align: left;
    }
    .shell-f__tile--current {
      border-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.08);
    }
    .shell-f__tile--rejected {
      opacity: 0.32;
    }
    .shell-f__thumb {
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 6.6rem;
      padding: 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.08);
      overflow: hidden;
    }
    .shell-f__thumb-row {
      display: flex;
      gap: 0.4rem;
    }
    .shell-f__block {
      height: 0.8rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .shell-f__tile--current .shell-f__block {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.35);
    }
    .shell-f__tile-name {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .shell-f__tile--current .shell-f__tile-name {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-f__canvas {
      display: grid;
      place-items: center;
      min-height: 0;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.03) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .shell-f__canvas span {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.4rem;
    }
    .shell-f__option-line {
      display: flex;
      gap: 1.2rem;
      align-items: baseline;
      padding-top: 1.4rem;
    }
    .shell-f__option-line b {
      font-weight: 500;
      font-size: 1.4rem;
    }
    .shell-f__option-line span {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.2rem;
    }
    .shell-f__verbs {
      display: flex;
      gap: 0.8rem;
      padding-top: 1.2rem;
    }
    .shell-f__verb {
      padding: 0.8rem 1.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
    }
    .shell-f__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .shell-f__chat-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-f__chat-head b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-f__chat-head span {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }
    .shell-f__chat-empty {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 2.4rem;
    }
    .shell-f__chat-empty p {
      margin: 0;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      text-align: center;
    }
    .shell-f__composer {
      display: grid;
      gap: 1rem;
      justify-items: end;
      padding: 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-f__textarea {
      justify-self: stretch;
      min-height: 9rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-f__composer-buttons {
      display: flex;
      gap: 0.8rem;
    }
    .shell-f__composer-buttons .shell-f__verb {
      padding: 0.6rem 1.4rem;
      font-size: 1.3rem;
    }
    .shell-f__status {
      display: flex;
      gap: 1.6rem;
      align-items: center;
      height: 3.2rem;
      padding: 0 1.4rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }
    .shell-f__status-item {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .shell-f__status-spacer {
      flex: 1;
    }
    .shell-f__dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }
    .shell-f__reload {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.2rem 0.8rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.06);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
    }
    .shell-f__reload svg {
      width: 1.2rem;
      height: 1.2rem;
    }
  `,
});
