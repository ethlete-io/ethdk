import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const CURRENT_VARIANT = 'b';

const current = shell.call.variants.find((variant) => variant.key === CURRENT_VARIANT);

export default drawing({
  body: html`
    <div class="shell-b et-surface--dark et-color--brand">
      <div class="shell-b__top">
        <span class="shell-b__checkout">${shell.checkout}</span>
        <span class="shell-b__server"><i></i>${shell.server}</span>
      </div>

      <div class="shell-b__body">
        <aside class="shell-b__explorer">
          <div class="shell-b__explorer-head">
            <div class="shell-b__project">
              <h2>${shell.project}</h2>
              <button class="shell-b__project-switch">Project <span>▾</span></button>
            </div>
            <div class="shell-b__search"><i></i><span>Search calls</span></div>
          </div>

          <div class="shell-b__explorer-list">
            ${shell.features.map(
              (feature) => html`
                <section class="shell-b__group">
                  <div class="shell-b__group-head">
                    <span class="shell-b__group-name">${feature.name}</span>
                    <span class="shell-b__group-open">${feature.open} open</span>
                  </div>
                  ${feature.calls.map(
                    (call) => html`
                      <button class="shell-b__call" ${call.open && 'data-open'}>
                        <span class="shell-b__call-eyebrow">${call.eyebrow}</span>
                        <span class="shell-b__call-headline">${call.headline}</span>
                        <span class="shell-b__call-settled">${call.settled}</span>
                      </button>
                    `,
                  )}
                </section>
              `,
            )}
          </div>
        </aside>

        <main class="shell-b__workspace et-surface--dark-elevated">
          <header class="shell-b__call-head">
            <span class="shell-b__call-eyebrow">${shell.call.eyebrow}</span>
            <h1>${shell.call.headline}</h1>
            <span class="shell-b__round">${shell.call.round}</span>
          </header>

          <div class="shell-b__switcher">
            ${shell.call.variants.map(
              (variant) => html`
                <button
                  class="shell-b__variant"
                  data-state="${
                    variant.verdict === 'rejected' ? 'rejected' : variant.key === CURRENT_VARIANT ? 'current' : 'open'
                  }"
                >
                  ${variant.name}${variant.verdict === 'rejected' && html`<em>rejected</em>`}
                </button>
              `,
            )}
          </div>

          <div class="shell-b__stage et-surface--dark-elevated-2">
            <span class="shell-b__stage-label">${current?.name}</span>
          </div>

          <footer class="shell-b__verbs">
            ${shell.verbs.map(
              (verb) => html`<button class="shell-b__verb" ${verb === 'Accept' && 'data-primary'}>${verb}</button>`,
            )}
          </footer>
        </main>

        <aside class="shell-b__chat">
          <div class="shell-b__chat-head">
            <span>Chat</span>
            <span class="shell-b__chat-scope">${shell.call.eyebrow}</span>
          </div>

          <div class="shell-b__chat-empty">${shell.chat}</div>

          <div class="shell-b__composer">
            <div class="shell-b__input"><span>Say what to change</span></div>
            <div class="shell-b__composer-foot">
              <span class="shell-b__agent">${shell.agent}</span>
              <div class="shell-b__composer-buttons">
                <button class="shell-b__verb">Stop</button>
                <button class="shell-b__verb" data-primary>Send</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: css`
    .shell-b {
      display: flex;
      flex-direction: column;
      width: 1440px;
      height: 900px;
      overflow: hidden;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font-family: Jost, system-ui, sans-serif;
      font-size: 1.4rem;
      line-height: 1.45;
    }

    .shell-b button {
      margin: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .shell-b__top {
      display: flex;
      flex: none;
      gap: 1.6rem;
      align-items: center;
      justify-content: space-between;
      height: 3.4rem;
      padding: 0 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.2rem;
    }

    .shell-b__server {
      display: inline-flex;
      gap: 0.8rem;
      align-items: center;
    }

    .shell-b__server i {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }

    .shell-b__body {
      display: grid;
      flex: 1;
      grid-template-columns: 30rem 1fr 34rem;
      min-height: 0;
    }

    .shell-b__explorer {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      border-right: 0.1rem solid var(--et-surface-border-solid);
    }

    .shell-b__explorer-head {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: 1.4rem;
      padding: 1.8rem 1.6rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }

    .shell-b__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }

    .shell-b__project h2 {
      margin: 0;
      font-size: 2rem;
      font-weight: 500;
      letter-spacing: 0.01em;
    }

    .shell-b__project-switch {
      display: inline-flex;
      gap: 0.6rem;
      align-items: center;
      padding: 0.4rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }

    .shell-b__project-switch span {
      color: var(--et-surface-color-subtle-solid);
    }

    .shell-b__search {
      display: flex;
      gap: 0.9rem;
      align-items: center;
      height: 3.4rem;
      padding: 0 1.1rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }

    .shell-b__search i {
      position: relative;
      width: 1.1rem;
      height: 1.1rem;
      border: 0.15rem solid currentcolor;
      border-radius: 50%;
    }

    .shell-b__search i::after {
      position: absolute;
      top: 0.9rem;
      left: 0.85rem;
      width: 0.45rem;
      border-top: 0.15rem solid currentcolor;
      transform: rotate(45deg);
      content: '';
    }

    .shell-b__explorer-list {
      flex: 1;
      min-height: 0;
      padding: 0.8rem 0 2rem;
      overflow: hidden;
    }

    .shell-b__group-head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 1.2rem 1.6rem 0.6rem;
    }

    .shell-b__group-name {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .shell-b__group-open {
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
    }

    .shell-b__call {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      width: 100%;
      padding: 0.9rem 1.6rem 0.9rem 1.3rem;
      border-left: 0.3rem solid transparent;
      text-align: left;
    }

    .shell-b__call:hover {
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }

    .shell-b__call[data-open] {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.12);
    }

    .shell-b__call-eyebrow {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }

    .shell-b__call-headline {
      display: -webkit-box;
      overflow: hidden;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.35rem;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .shell-b__call[data-open] .shell-b__call-headline {
      color: var(--et-surface-color-solid);
    }

    .shell-b__call-settled {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.1rem;
    }

    .shell-b__call[data-open] .shell-b__call-settled {
      color: var(--et-theme-color-ink-solid);
    }

    .shell-b__workspace {
      display: flex;
      flex-direction: column;
      gap: 1.8rem;
      min-width: 0;
      min-height: 0;
      padding: 2.4rem 2.8rem 2.2rem;
      overflow: hidden;
      background: var(--et-surface-background-solid);
    }

    .shell-b__call-head {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: 0.4rem;
    }

    .shell-b__call-head h1 {
      margin: 0;
      font-size: 2.4rem;
      font-weight: 500;
      line-height: 1.2;
    }

    .shell-b__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }

    .shell-b__switcher {
      display: inline-flex;
      flex: none;
      gap: 0.4rem;
      align-self: flex-start;
      padding: 0.4rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.7rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
    }

    .shell-b__variant {
      display: inline-flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0.7rem 1.4rem;
      border-radius: 0.5rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
    }

    .shell-b__variant[data-state='current'] {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.16);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-theme-color-primary-rgb) / 0.45);
      color: var(--et-theme-color-ink-solid);
    }

    .shell-b__variant[data-state='rejected'] {
      color: var(--et-surface-color-subtle-solid);
      opacity: 0.6;
    }

    .shell-b__variant em {
      padding: 0.1rem 0.5rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.3rem;
      font-size: 1rem;
      font-style: normal;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .shell-b__variant:hover[data-state='open'] {
      background: rgb(var(--et-surface-color-rgb) / 0.07);
      color: var(--et-surface-color-solid);
    }

    .shell-b__stage {
      display: flex;
      flex: 1;
      align-items: flex-end;
      min-height: 0;
      padding: 1.4rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.8rem;
      background:
        repeating-linear-gradient(135deg, transparent 0 1.1rem, rgb(var(--et-surface-color-rgb) / 0.035) 1.1rem 1.2rem),
        var(--et-surface-background-solid);
      box-shadow: 0 0.2rem 1.2rem rgb(0 0 0 / 0.28);
    }

    .shell-b__stage-label {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }

    .shell-b__verbs {
      display: flex;
      flex: none;
      gap: 0.8rem;
      align-items: center;
    }

    .shell-b__verb {
      padding: 0.8rem 1.6rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-solid);
      font-size: 1.4rem;
    }

    .shell-b__verb:hover {
      background: rgb(var(--et-surface-color-rgb) / 0.08);
    }

    .shell-b__verb[data-primary] {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary);
      font-weight: 500;
    }

    .shell-b__chat {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      border-left: 0.1rem solid var(--et-surface-border-solid);
    }

    .shell-b__chat-head {
      display: flex;
      flex: none;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 1.8rem 1.6rem 1.4rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
      font-size: 1.5rem;
      font-weight: 500;
    }

    .shell-b__chat-scope {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      font-weight: 400;
    }

    .shell-b__chat-empty {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 2rem;
      overflow: hidden;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      text-align: center;
    }

    .shell-b__composer {
      display: flex;
      flex: none;
      flex-direction: column;
      gap: 1.2rem;
      padding: 1.4rem 1.6rem 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.03);
    }

    .shell-b__input {
      height: 9rem;
      padding: 1.1rem 1.2rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
    }

    .shell-b__composer-foot {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    .shell-b__agent {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }

    .shell-b__composer-buttons {
      display: flex;
      gap: 0.8rem;
    }

    .shell-b__composer-buttons .shell-b__verb {
      padding: 0.6rem 1.4rem;
      font-size: 1.3rem;
    }
  `,
});
