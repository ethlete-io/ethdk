import { css, drawing, html } from '@design-explore';
import { shell } from './shell';

const CURRENT_VARIANT = 'b';

export default drawing({
  body: html`
    <div class="shell-c et-surface--dark">
      <aside class="shell-c__explorer et-surface--dark-elevated">
        <header class="shell-c__explorer-head">
          <div class="shell-c__project">
            <h1>${shell.project}</h1>
            <button class="shell-c__project-switch" type="button">Projects <span>▾</span></button>
          </div>
          <div class="shell-c__search">
            <span class="shell-c__search-mark">⌕</span>
            <span class="shell-c__search-label">Search calls</span>
            <kbd>⌘K</kbd>
          </div>
        </header>

        <div class="shell-c__explorer-body">
          ${shell.features.map(
            (feature) => html`
              <section class="shell-c__group">
                <div class="shell-c__group-head">
                  <span class="shell-c__group-name">${feature.name}</span>
                  <span class="shell-c__group-open">${feature.open} open</span>
                </div>
                ${feature.calls.map(
                  (call) => html`
                    <article class="shell-c__row${call.open ? ' shell-c__row--open' : ''}">
                      <span class="shell-c__row-eyebrow">${call.eyebrow}</span>
                      <span class="shell-c__row-headline">${call.headline}</span>
                      <span class="shell-c__row-settled">${call.settled}</span>
                    </article>
                  `,
                )}
              </section>
            `,
          )}
        </div>

        <footer class="shell-c__explorer-foot">
          <span class="shell-c__checkout">${shell.checkout}</span>
          <span class="shell-c__server"><i></i>${shell.server}</span>
        </footer>
      </aside>

      <main class="shell-c__workspace">
        <header class="shell-c__workspace-head">
          <div class="shell-c__call">
            <span class="shell-c__call-eyebrow">${shell.call.eyebrow}</span>
            <h2>${shell.call.headline}</h2>
            <span class="shell-c__call-round">${shell.call.round}</span>
          </div>
          <div class="shell-c__switcher">
            ${shell.call.variants.map(
              (variant) => html`
                <button
                  class="shell-c__variant${
                    variant.key === CURRENT_VARIANT ? ' shell-c__variant--current' : ''
                  }${variant.verdict === 'rejected' ? ' shell-c__variant--rejected' : ''}"
                  type="button"
                >
                  ${variant.name}
                </button>
              `,
            )}
          </div>
        </header>

        <div class="shell-c__stage">
          <div class="shell-c__canvas et-surface--dark-elevated-2">
            <div class="shell-c__canvas-head">
              <span>${shell.call.variants.find((variant) => variant.key === CURRENT_VARIANT)?.name}</span>
              <span class="shell-c__canvas-size">1440 × 640</span>
            </div>
            <div class="shell-c__canvas-body"></div>
          </div>
        </div>

        <footer class="shell-c__verbs">
          ${shell.verbs.map(
            (verb, index) => html`
              <button class="shell-c__verb${index === 0 ? ' shell-c__verb--primary' : ''}" type="button">
                ${verb}
              </button>
            `,
          )}
        </footer>
      </main>

      <aside class="shell-c__chat et-surface--dark-elevated">
        <header class="shell-c__chat-head">
          <span class="shell-c__chat-name">Conversation</span>
          <span class="shell-c__chat-sub">${shell.call.eyebrow}</span>
        </header>

        <div class="shell-c__chat-body">
          <p>${shell.chat}</p>
        </div>

        <footer class="shell-c__composer">
          <div class="shell-c__composer-field">Say what the next round should try…</div>
          <div class="shell-c__composer-foot">
            <span class="shell-c__agent">${shell.agent}</span>
            <div class="shell-c__composer-actions">
              <button class="shell-c__verb" type="button">Stop</button>
              <button class="shell-c__verb shell-c__verb--primary" type="button">Send</button>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  `,
  styles: css`
    .shell-c {
      --et-surface-interaction: var(--et-surface-color);

      display: grid;
      grid-template-columns: 300px minmax(0, 1fr) 340px;
      height: 900px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font-family: Jost, system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    }

    .shell-c *,
    .shell-c *::before,
    .shell-c *::after {
      box-sizing: border-box;
    }

    .shell-c h1,
    .shell-c h2,
    .shell-c p {
      margin: 0;
    }

    .shell-c__explorer,
    .shell-c__workspace,
    .shell-c__chat {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      min-height: 0;
      background: var(--et-surface-background-solid);
    }

    .shell-c__explorer {
      border-right: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__chat {
      border-left: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__explorer-head {
      display: grid;
      gap: 14px;
      padding: 18px 16px 14px;
      border-bottom: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__project {
      display: flex;
      gap: 10px;
      align-items: baseline;
      justify-content: space-between;
    }

    .shell-c__project h1 {
      font-size: 20px;
      font-weight: 500;
      letter-spacing: 0.01em;
    }

    .shell-c__project-switch {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 4px 8px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 4px;
      background: transparent;
      color: var(--et-surface-color-muted-solid);
      font: inherit;
      font-size: 12px;
    }

    .shell-c__project-switch span {
      color: var(--et-surface-color-subtle-solid);
    }

    .shell-c__search {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 7px 10px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 4px;
      background: color-mix(in srgb, var(--et-surface-interaction-solid) 6%, transparent);
    }

    .shell-c__search-mark {
      color: var(--et-surface-color-subtle-solid);
      font-size: 15px;
    }

    .shell-c__search-label {
      flex: 1;
      color: var(--et-surface-color-subtle-solid);
      font-size: 13px;
    }

    .shell-c__search kbd,
    .shell-c__checkout,
    .shell-c__server,
    .shell-c__canvas-size,
    .shell-c__agent {
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
    }

    .shell-c__search kbd {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
    }

    .shell-c__explorer-body {
      overflow: hidden;
      padding: 8px 8px 16px;
    }

    .shell-c__group + .shell-c__group {
      margin-top: 14px;
    }

    .shell-c__group-head {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      padding: 8px;
    }

    .shell-c__group-name {
      color: var(--et-surface-color-muted-solid);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .shell-c__group-open {
      color: var(--et-theme-color-ink-solid);
      font-size: 11px;
    }

    .shell-c__row {
      display: grid;
      gap: 3px;
      padding: 9px 10px;
      border: 1px solid transparent;
      border-radius: 4px;
    }

    .shell-c__row--open {
      border-color: color-mix(in srgb, var(--et-theme-color-ink-solid) 45%, transparent);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.14);
    }

    .shell-c__row-eyebrow {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
      letter-spacing: 0.04em;
    }

    .shell-c__row--open .shell-c__row-eyebrow {
      color: var(--et-theme-color-ink-solid);
    }

    .shell-c__row-headline {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      color: var(--et-surface-color-muted-solid);
      font-size: 13px;
    }

    .shell-c__row--open .shell-c__row-headline {
      color: var(--et-surface-color-solid);
    }

    .shell-c__row-settled {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
    }

    .shell-c__explorer-foot {
      display: grid;
      gap: 4px;
      padding: 12px 16px 14px;
      border-top: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__checkout {
      overflow: hidden;
      color: var(--et-surface-color-muted-solid);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .shell-c__server {
      display: flex;
      gap: 7px;
      align-items: center;
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
    }

    .shell-c__server i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }

    .shell-c__workspace-head {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      justify-content: space-between;
      padding: 22px 28px 16px;
      border-bottom: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__call {
      display: grid;
      gap: 5px;
      max-width: 560px;
    }

    .shell-c__call-eyebrow {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .shell-c__call h2 {
      font-size: 22px;
      font-weight: 500;
      line-height: 1.25;
    }

    .shell-c__call-round {
      color: var(--et-surface-color-muted-solid);
      font-size: 12px;
    }

    .shell-c__switcher {
      display: flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 6px;
      background: color-mix(in srgb, var(--et-surface-interaction-solid) 6%, transparent);
    }

    .shell-c__variant {
      padding: 7px 12px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: var(--et-surface-color-muted-solid);
      font: inherit;
      font-size: 12px;
      white-space: nowrap;
    }

    .shell-c__variant--current {
      border-color: var(--et-theme-color-ink-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.16);
      color: var(--et-theme-color-ink-solid);
    }

    .shell-c__variant--rejected {
      color: var(--et-surface-color-subtle-solid);
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, var(--et-surface-color-subtle-solid) 60%, transparent);
    }

    .shell-c__stage {
      display: flex;
      overflow: hidden;
      padding: 22px 28px;
    }

    .shell-c__canvas {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      flex: 1;
      overflow: hidden;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 6px;
      background: var(--et-surface-background-solid);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
    }

    .shell-c__canvas-head {
      display: flex;
      gap: 12px;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--et-surface-border-solid);
      color: var(--et-surface-color-muted-solid);
      font-size: 12px;
    }

    .shell-c__canvas-size {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
    }

    .shell-c__canvas-body {
      background:
        repeating-linear-gradient(
          to right,
          color-mix(in srgb, var(--et-surface-border-solid) 55%, transparent) 0 1px,
          transparent 1px 48px
        ),
        repeating-linear-gradient(
          to bottom,
          color-mix(in srgb, var(--et-surface-border-solid) 55%, transparent) 0 1px,
          transparent 1px 48px
        );
    }

    .shell-c__verbs {
      display: flex;
      gap: 8px;
      padding: 14px 28px 18px;
      border-top: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__verb {
      padding: 8px 16px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 4px;
      background: transparent;
      color: var(--et-surface-color-muted-solid);
      font: inherit;
      font-size: 13px;
    }

    .shell-c__verb--primary {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary);
      font-weight: 500;
    }

    .shell-c__chat-head {
      display: grid;
      gap: 3px;
      padding: 18px 18px 14px;
      border-bottom: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__chat-name {
      font-size: 16px;
      font-weight: 500;
    }

    .shell-c__chat-sub {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .shell-c__chat-body {
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 24px 18px;
    }

    .shell-c__chat-body p {
      color: var(--et-surface-color-subtle-solid);
      font-size: 13px;
      text-align: center;
    }

    .shell-c__composer {
      display: grid;
      gap: 10px;
      padding: 14px 18px 18px;
      border-top: 1px solid var(--et-surface-border-solid);
    }

    .shell-c__composer-field {
      min-height: 84px;
      padding: 10px 12px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 4px;
      background: color-mix(in srgb, var(--et-surface-interaction-solid) 6%, transparent);
      color: var(--et-surface-color-subtle-solid);
      font-size: 13px;
    }

    .shell-c__composer-foot {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .shell-c__agent {
      color: var(--et-surface-color-subtle-solid);
      font-size: 11px;
    }

    .shell-c__composer-actions {
      display: flex;
      gap: 8px;
    }

    .shell-c__composer-actions .shell-c__verb {
      padding: 6px 14px;
      font-size: 12px;
    }
  `,
});
