import { css, drawing, html } from '@design-explore';
import { explorer } from './explorer';

export default drawing({
  body: html`
    <div class="explorer-c et-surface--dark-elevated et-color--brand">
      <header class="explorer-c__head">
        <div class="explorer-c__project">
          <h1>${explorer.project}</h1>
          <button class="explorer-c__projects">
            Projects
            <span class="explorer-c__badge">${explorer.projects.length}</span>
            <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
          </button>
        </div>
        <div class="explorer-c__search">
          <svg viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <span>${explorer.search}</span>
        </div>
      </header>

      <div class="explorer-c__filters">
        <div class="explorer-c__chips">
          <button class="explorer-c__chip explorer-c__chip--on">All</button>
          ${explorer.features.map((feature) => html`<button class="explorer-c__chip">${feature}</button>`)}
        </div>
        <button class="explorer-c__toggle">
          <span class="explorer-c__switch"><i></i></span>
          Open only
        </button>
      </div>

      <div class="explorer-c__list">
        ${explorer.calls.map(
          (call) => html`
            <article
              class="explorer-c__call${call.open && ' explorer-c__call--open'}${
                call.settled === call.rounds && ' explorer-c__call--done'
              }"
            >
              <b class="explorer-c__headline">${call.headline}</b>
              <div class="explorer-c__meta">
                <span class="explorer-c__tag${call.feature === 'No feature' && ' explorer-c__tag--none'}"
                  >${call.feature}</span
                >
                <span class="explorer-c__eyebrow">${call.eyebrow}</span>
                <span class="explorer-c__rounds">
                  <span class="explorer-c__track">
                    <i style="width: ${Math.round((call.settled / call.rounds) * 100)}%"></i>
                  </span>
                  ${call.settled}/${call.rounds}
                </span>
                <span class="explorer-c__touched">${call.touched}</span>
              </div>
            </article>
          `,
        )}
      </div>
    </div>
  `,
  styles: css`
    .explorer-c {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      width: 42rem;
      min-height: 90rem;
      border-right: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-c button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .explorer-c svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .explorer-c__head {
      display: grid;
      gap: 1.2rem;
      padding: 1.8rem 1.4rem 1.4rem;
    }
    .explorer-c__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .explorer-c__project h1 {
      margin: 0;
      font:
        500 2.2rem/1.15 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-c__projects {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0.8rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .explorer-c__badge {
      padding: 0 0.4rem;
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.08);
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
    }
    .explorer-c__search {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0.7rem 1rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.25rem;
    }
    .explorer-c__filters {
      display: grid;
      gap: 1rem;
      padding: 0 1.4rem 1.2rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .explorer-c__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .explorer-c__chip {
      padding: 0.4rem 0.8rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.1rem;
      line-height: 1.3;
    }
    .explorer-c__chip--on {
      border-color: transparent;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
    }
    .explorer-c__toggle {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      justify-self: start;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .explorer-c__switch {
      display: flex;
      align-items: center;
      width: 2.8rem;
      height: 1.6rem;
      padding: 0.2rem;
      border-radius: 0.8rem;
      background: rgb(var(--et-surface-color-rgb) / 0.14);
    }
    .explorer-c__switch i {
      width: 1.2rem;
      height: 1.2rem;
      border-radius: 50%;
      background: var(--et-surface-color-subtle-solid);
    }
    .explorer-c__list {
      display: grid;
      align-content: start;
    }
    .explorer-c__call {
      display: grid;
      gap: 0.5rem;
      padding: 0.9rem 1.4rem 0.9rem 1.2rem;
      border-bottom: 0.1rem solid rgb(var(--et-surface-color-rgb) / 0.06);
      border-left: 0.2rem solid transparent;
    }
    .explorer-c__headline {
      color: var(--et-surface-color-muted-solid);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .explorer-c__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 0.8rem;
      align-items: center;
    }
    .explorer-c__tag {
      padding: 0.1rem 0.6rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.08);
      color: var(--et-surface-color-muted-solid);
      font-size: 1.05rem;
      line-height: 1.5;
      white-space: nowrap;
    }
    .explorer-c__tag--none {
      border: 0.1rem dashed rgb(var(--et-surface-color-rgb) / 0.2);
      padding: 0 0.5rem;
      background: none;
      color: var(--et-surface-color-subtle-solid);
    }
    .explorer-c__eyebrow,
    .explorer-c__touched,
    .explorer-c__rounds {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.05rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .explorer-c__touched {
      margin-left: auto;
    }
    .explorer-c__rounds {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .explorer-c__track {
      display: block;
      width: 2rem;
      height: 0.4rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.14);
      overflow: hidden;
    }
    .explorer-c__track i {
      display: block;
      height: 100%;
      background: var(--et-theme-color-primary-solid);
    }
    .explorer-c__call--done .explorer-c__track i {
      background: rgb(var(--et-surface-color-rgb) / 0.32);
    }
    .explorer-c__call--open {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .explorer-c__call--open .explorer-c__headline {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .explorer-c__call--open .explorer-c__tag {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.22);
      color: var(--et-theme-color-ink-solid);
    }
    .explorer-c__call--open .explorer-c__eyebrow,
    .explorer-c__call--open .explorer-c__rounds,
    .explorer-c__call--open .explorer-c__touched {
      color: var(--et-theme-color-ink-solid);
    }
  `,
});
