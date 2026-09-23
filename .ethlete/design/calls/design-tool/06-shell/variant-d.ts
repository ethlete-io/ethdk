import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const current = shell.call.variants.find((variant) => variant.verdict !== 'rejected');

export default drawing({
  body: html`
    <div class="shell-d et-surface--dark et-color--brand">
      <aside class="shell-d__explorer et-surface--dark-elevated">
        <header class="shell-d__head">
          <div class="shell-d__project">
            <h1>${shell.project}</h1>
            <button class="shell-d__projects" type="button">
              Projects
              <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
            </button>
          </div>
          <div class="shell-d__search">
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <span>Search calls</span>
            <kbd>⌘K</kbd>
          </div>
        </header>

        <div class="shell-d__groups">
          ${shell.features.map(
            (feature) => html`
              <section class="shell-d__group">
                <div class="shell-d__group-head">
                  <b>${feature.name}</b>
                  <span>${feature.open} open</span>
                </div>
                ${feature.calls.map(
                  (call) => html`
                    <article class="shell-d__call${call.open && ' shell-d__call--open'}">
                      <span class="shell-d__eyebrow">${call.eyebrow}</span>
                      <b>${call.headline}</b>
                      <span class="shell-d__settled">${call.settled}</span>
                    </article>
                  `,
                )}
              </section>
            `,
          )}
        </div>

        <footer class="shell-d__foot">
          <div class="shell-d__checkout-row">
            <span class="shell-d__checkout">${shell.checkout}</span>
            <button class="shell-d__reload" type="button">
              <svg viewBox="0 0 24 24">
                <path d="M20 12a8 8 0 1 1-2.6-5.9" />
                <path d="M20 4v4h-4" />
              </svg>
              Reload
            </button>
          </div>
          <span class="shell-d__server"><i></i>${shell.server}</span>
        </footer>
      </aside>

      <main class="shell-d__workspace">
        <header class="shell-d__call-head">
          <span class="shell-d__eyebrow">${shell.call.eyebrow}</span>
          <h2>${shell.call.headline}</h2>
          <span class="shell-d__round">${shell.call.round}</span>
        </header>

        <div class="shell-d__stage">
          <div class="shell-d__tiles">
            ${shell.call.variants.map(
              (variant) => html`
                <button
                  class="shell-d__tile${variant.key === current?.key && ' shell-d__tile--current'}${
                    variant.verdict === 'rejected' && ' shell-d__tile--rejected'
                  }"
                  type="button"
                >
                  <span class="shell-d__thumb">
                    <i class="shell-d__thumb-bar"></i>
                    <i class="shell-d__thumb-block"></i>
                    <i class="shell-d__thumb-block shell-d__thumb-block--short"></i>
                    <i class="shell-d__thumb-block shell-d__thumb-block--wide"></i>
                  </span>
                  <span class="shell-d__tile-name">${variant.name}</span>
                </button>
              `,
            )}
          </div>

          <div class="shell-d__drawing">
            <div class="shell-d__canvas"><span>1440 × 640</span></div>

            <div class="shell-d__option">
              <span class="shell-d__option-name">${current?.name}</span>
              <span class="shell-d__option-state">not checked</span>
              <span class="shell-d__option-address">/fifagg/competition-navigation/16/${current?.key}</span>
            </div>

            <div class="shell-d__verbs">
              ${shell.verbs.map(
                (verb, index) => html`
                  <button class="shell-d__verb${index === 0 && ' shell-d__verb--primary'}" type="button">
                    ${verb}
                  </button>
                `,
              )}
            </div>
          </div>
        </div>
      </main>

      <aside class="shell-d__chat et-surface--dark-elevated">
        <header class="shell-d__chat-head">
          <b>Conversation</b>
          <span>${shell.call.eyebrow}</span>
        </header>

        <div class="shell-d__chat-body"><p>${shell.chat}</p></div>

        <footer class="shell-d__composer">
          <div class="shell-d__field">Say what the next round should try…</div>
          <div class="shell-d__composer-foot">
            <span class="shell-d__agent">${shell.agent}</span>
            <div class="shell-d__composer-actions">
              <button class="shell-d__verb" type="button">Stop</button>
              <button class="shell-d__verb shell-d__verb--primary" type="button">Send</button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  `,
  styles: css`
    .shell-d {
      --et-surface-interaction: var(--et-surface-color);

      display: grid;
      grid-template-columns: 40rem minmax(0, 1fr) 36rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-d *,
    .shell-d *::before,
    .shell-d *::after {
      box-sizing: border-box;
    }
    .shell-d h1,
    .shell-d h2,
    .shell-d p {
      margin: 0;
    }
    .shell-d button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .shell-d svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .shell-d__eyebrow,
    .shell-d__settled,
    .shell-d__checkout,
    .shell-d__server,
    .shell-d__agent,
    .shell-d__option-address {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shell-d__explorer,
    .shell-d__chat {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      min-height: 0;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .shell-d__explorer {
      border-right: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-d__chat {
      border-left: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-d__head {
      display: grid;
      gap: 1.4rem;
      padding: 2rem 1.8rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-d__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-d__project h1 {
      font:
        500 2.2rem/1.2 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-d__projects {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-interaction) / 0.06);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-d__search {
      display: flex;
      gap: 0.9rem;
      align-items: center;
      padding: 0.9rem 1.1rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-interaction) / 0.05);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-d__search span {
      flex: 1;
    }
    .shell-d__search kbd {
      padding: 0.1rem 0.5rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
    }
    .shell-d__groups {
      display: grid;
      align-content: start;
      gap: 2.4rem;
      padding: 1.8rem 0;
      overflow: hidden;
    }
    .shell-d__group-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 1.8rem 0.8rem;
    }
    .shell-d__group-head b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-d__group-head span {
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
    }
    .shell-d__call {
      display: grid;
      gap: 0.3rem;
      padding: 1rem 1.8rem;
      border-left: 0.2rem solid transparent;
    }
    .shell-d__call b {
      color: var(--et-surface-color-muted-solid);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .shell-d__call--open {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .shell-d__call--open b {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .shell-d__call--open .shell-d__eyebrow {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-d__foot {
      display: grid;
      gap: 0.8rem;
      padding: 1.4rem 1.8rem 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-interaction) / 0.03);
    }
    .shell-d__checkout-row {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
    }
    .shell-d__reload {
      display: inline-flex;
      flex: none;
      gap: 0.5rem;
      align-items: center;
      padding: 0.4rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-d__server {
      display: flex;
      gap: 0.6rem;
      align-items: center;
    }
    .shell-d__server i {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }
    .shell-d__workspace {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
      padding: 2.4rem 3.2rem 2.2rem;
    }
    .shell-d__call-head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1.8rem;
    }
    .shell-d__call-head h2 {
      max-width: 76rem;
      font:
        500 2.2rem/1.25 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-d__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }
    .shell-d__stage {
      display: grid;
      grid-template-columns: 12rem minmax(0, 1fr);
      gap: 1.6rem;
      min-height: 0;
    }
    .shell-d__tiles {
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 0;
      overflow: hidden;
    }
    .shell-d__tile {
      display: grid;
      gap: 0.6rem;
      padding: 0.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-interaction) / 0.04);
      text-align: left;
    }
    .shell-d__tile--current {
      border-color: var(--et-theme-color-ink-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.12);
    }
    .shell-d__tile--rejected {
      opacity: 0.32;
    }
    .shell-d__thumb {
      display: grid;
      align-content: start;
      gap: 0.4rem;
      height: 6.4rem;
      padding: 0.6rem;
      border-radius: 0.3rem;
      background: var(--et-surface-background-solid);
      overflow: hidden;
    }
    .shell-d__thumb-bar {
      height: 0.8rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-interaction) / 0.22);
    }
    .shell-d__thumb-block {
      height: 1.4rem;
      border-radius: 0.1rem;
      background: rgb(var(--et-surface-interaction) / 0.1);
    }
    .shell-d__thumb-block--short {
      width: 60%;
    }
    .shell-d__thumb-block--wide {
      height: 1rem;
      width: 80%;
    }
    .shell-d__tile--current .shell-d__thumb-bar {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.55);
    }
    .shell-d__tile-name {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .shell-d__tile--current .shell-d__tile-name {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-d__drawing {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto auto;
      gap: 1.2rem;
      min-height: 0;
    }
    .shell-d__canvas {
      display: grid;
      place-items: center;
      min-height: 0;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1rem;
      background:
        repeating-linear-gradient(
          135deg,
          rgb(var(--et-surface-interaction) / 0.03) 0 0.1rem,
          transparent 0.1rem 1.4rem
        ),
        rgb(var(--et-surface-interaction) / 0.03);
    }
    .shell-d__canvas span {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.2rem;
    }
    .shell-d__option {
      display: flex;
      gap: 1.4rem;
      align-items: baseline;
      min-width: 0;
    }
    .shell-d__option-name {
      color: var(--et-surface-color-solid);
      font-size: 1.5rem;
    }
    .shell-d__option-state {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-d__verbs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }
    .shell-d__verb {
      padding: 0.8rem 1.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-interaction) / 0.04);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
    }
    .shell-d__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .shell-d__chat-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 2rem 1.8rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-d__chat-head b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-d__chat-head span {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }
    .shell-d__chat-body {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 2.4rem;
    }
    .shell-d__chat-body p {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      text-align: center;
    }
    .shell-d__composer {
      display: grid;
      gap: 1rem;
      padding: 1.6rem 1.8rem 1.8rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-d__field {
      min-height: 9rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-interaction) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-d__composer-foot {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-d__composer-actions {
      display: flex;
      gap: 0.8rem;
    }
    .shell-d__composer-actions .shell-d__verb {
      padding: 0.6rem 1.4rem;
      font-size: 1.3rem;
    }
  `,
});
