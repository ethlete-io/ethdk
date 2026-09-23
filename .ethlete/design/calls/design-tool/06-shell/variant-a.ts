import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const current = shell.call.variants.find((variant) => variant.verdict !== 'rejected');

export default drawing({
  body: html`
    <div class="shell-a et-surface--dark et-color--brand">
      <header class="shell-a__bar">
        <span class="shell-a__checkout">${shell.checkout}</span>
        <div class="shell-a__switcher">
          ${shell.call.variants.map((variant) => {
            const [key, name] = variant.name.split(' · ');

            return html`
              <button
                class="shell-a__variant${variant.key === current?.key && ' shell-a__variant--current'}${
                  variant.verdict === 'rejected' && ' shell-a__variant--rejected'
                }"
              >
                <b>${key}</b><span>${name}</span>
              </button>
            `;
          })}
        </div>
        <span class="shell-a__server">${shell.server}</span>
      </header>

      <div class="shell-a__body">
        <aside class="shell-a__explorer et-surface--dark-elevated">
          <div class="shell-a__explorer-head">
            <div class="shell-a__project">
              <h1>${shell.project}</h1>
              <button class="shell-a__project-switch">
                Projects
                <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
              </button>
            </div>
            <div class="shell-a__search">
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
              <span>Search calls</span>
            </div>
          </div>

          <div class="shell-a__groups">
            ${shell.features.map(
              (feature) => html`
                <section class="shell-a__group">
                  <header class="shell-a__group-head"><b>${feature.name}</b><span>${feature.open} open</span></header>
                  ${feature.calls.map(
                    (call) => html`
                      <article class="shell-a__call${call.open && ' shell-a__call--open'}">
                        <span class="shell-a__eyebrow">${call.eyebrow}</span>
                        <b>${call.headline}</b>
                        <span class="shell-a__settled">${call.settled}</span>
                      </article>
                    `,
                  )}
                </section>
              `,
            )}
          </div>
        </aside>

        <main class="shell-a__workspace">
          <div class="shell-a__workspace-head">
            <span class="shell-a__eyebrow">${shell.call.eyebrow}</span>
            <h2>${shell.call.headline}</h2>
            <span class="shell-a__round">${shell.call.round}</span>
          </div>

          <div class="shell-a__canvas"><span>${current?.name}</span></div>

          <div class="shell-a__verbs">
            ${shell.verbs.map(
              (verb) => html`
                <button class="shell-a__verb${verb === 'Accept' && ' shell-a__verb--primary'}">${verb}</button>
              `,
            )}
          </div>
        </main>

        <aside class="shell-a__chat et-surface--dark-elevated">
          <header class="shell-a__chat-head"><b>Chat</b><span>${shell.call.eyebrow}</span></header>

          <div class="shell-a__chat-empty"><p>${shell.chat}</p></div>

          <div class="shell-a__composer">
            <div class="shell-a__textarea">Ask for another take, or say what to change.</div>
            <div class="shell-a__composer-foot">
              <span class="shell-a__agent">${shell.agent}</span>
              <div class="shell-a__composer-buttons">
                <button class="shell-a__verb">Stop</button>
                <button class="shell-a__verb shell-a__verb--primary">Send</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: css`
    .shell-a {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: 144rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-a button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .shell-a svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .shell-a__bar {
      display: grid;
      grid-template-columns: 30rem minmax(0, 1fr) 34rem;
      align-items: center;
      height: 5.2rem;
      padding: 0 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.04);
    }
    .shell-a__checkout,
    .shell-a__server,
    .shell-a__agent,
    .shell-a__eyebrow,
    .shell-a__settled {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shell-a__server {
      justify-self: end;
    }
    .shell-a__switcher {
      display: flex;
      gap: 0.2rem;
      justify-self: center;
      max-width: 72rem;
      padding: 0.3rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.8rem;
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }
    .shell-a__variant {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      min-width: 0;
      padding: 0.5rem 1.2rem;
      border-radius: 0.5rem;
      color: var(--et-surface-color-muted-solid);
    }
    .shell-a__variant b {
      font-weight: 500;
      font-size: 1.3rem;
    }
    .shell-a__variant span {
      overflow: hidden;
      font-size: 1.3rem;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .shell-a__variant--current {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.16);
      color: var(--et-theme-color-ink-solid);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-theme-color-primary-rgb) / 0.4);
    }
    .shell-a__variant--rejected {
      color: var(--et-surface-color-subtle-solid);
      opacity: 0.5;
      text-decoration: line-through;
    }
    .shell-a__body {
      display: grid;
      grid-template-columns: 30rem minmax(0, 1fr) 34rem;
      min-height: 0;
    }
    .shell-a__explorer,
    .shell-a__chat {
      display: grid;
      min-height: 0;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .shell-a__explorer {
      grid-template-rows: auto minmax(0, 1fr);
      border-right: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-a__chat {
      grid-template-rows: auto minmax(0, 1fr) auto;
      border-left: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-a__explorer-head {
      display: grid;
      gap: 1.2rem;
      padding: 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-a__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-a__project h1 {
      margin: 0;
      font:
        500 2rem/1.2 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-a__project-switch {
      display: flex;
      gap: 0.4rem;
      align-items: center;
      padding: 0.4rem 0.8rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .shell-a__search {
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
    .shell-a__groups {
      display: grid;
      align-content: start;
      gap: 2.4rem;
      padding: 1.6rem 0;
      overflow: hidden;
    }
    .shell-a__group-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 0 1.6rem 0.8rem;
    }
    .shell-a__group-head b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--et-surface-color-muted-solid);
    }
    .shell-a__group-head span {
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
    }
    .shell-a__call {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1.6rem;
      border-left: 0.2rem solid transparent;
    }
    .shell-a__call b {
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
      color: var(--et-surface-color-muted-solid);
    }
    .shell-a__call--open {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .shell-a__call--open b {
      font-weight: 500;
      color: var(--et-surface-color-solid);
    }
    .shell-a__call--open .shell-a__eyebrow {
      color: var(--et-theme-color-ink-solid);
    }
    .shell-a__workspace {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      min-height: 0;
      padding: 2.4rem 3.2rem 2rem;
    }
    .shell-a__workspace-head {
      display: grid;
      gap: 0.4rem;
      padding-bottom: 1.8rem;
    }
    .shell-a__workspace-head h2 {
      margin: 0;
      max-width: 72rem;
      font:
        500 2.2rem/1.25 'Jost',
        system-ui,
        sans-serif;
    }
    .shell-a__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }
    .shell-a__canvas {
      display: grid;
      place-items: center;
      min-height: 0;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      background:
        repeating-linear-gradient(135deg, rgb(var(--et-surface-color-rgb) / 0.03) 0 0.1rem, transparent 0.1rem 1.4rem),
        rgb(var(--et-surface-color-rgb) / 0.03);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .shell-a__canvas span {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.4rem;
    }
    .shell-a__verbs {
      display: flex;
      gap: 0.8rem;
      padding-top: 1.6rem;
    }
    .shell-a__verb {
      padding: 0.8rem 1.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.4rem;
    }
    .shell-a__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .shell-a__chat-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-a__chat-head b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .shell-a__chat-head span {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }
    .shell-a__chat-empty {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 2.4rem;
    }
    .shell-a__chat-empty p {
      margin: 0;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      text-align: center;
    }
    .shell-a__composer {
      display: grid;
      gap: 1rem;
      padding: 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .shell-a__textarea {
      min-height: 9rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }
    .shell-a__composer-foot {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .shell-a__composer-buttons {
      display: flex;
      gap: 0.8rem;
    }
    .shell-a__composer-buttons .shell-a__verb {
      padding: 0.6rem 1.4rem;
      font-size: 1.3rem;
    }
  `,
});
