import { css, drawing, html } from '@design-explore';
import { ExplorerCall, explorer } from './explorer';

const COLLAPSED = 'onboarding';

const groups = explorer.features.map((feature) => {
  const calls = explorer.calls.filter((call) => call.feature === feature);

  return {
    feature,
    calls,
    open: calls.filter((call) => call.settled < call.rounds).length,
    collapsed: feature === COLLAPSED,
  };
});

const rounds = (call: ExplorerCall) =>
  Array.from(
    { length: call.rounds },
    (_, index) => html`<i class="explorer-a__dot${index < call.settled && ' explorer-a__dot--settled'}"></i>`,
  );

const callRow = (call: ExplorerCall) => html`
  <article class="explorer-a__call${call.open && ' explorer-a__call--current'}">
    <div class="explorer-a__call-top">
      <span class="explorer-a__eyebrow">${call.eyebrow}</span>
      <span class="explorer-a__progress">
        <span class="explorer-a__dots">${rounds(call)}</span>
        <span class="explorer-a__settled">${call.settled}/${call.rounds}</span>
      </span>
    </div>
    <b class="explorer-a__headline">${call.headline}</b>
  </article>
`;

export default drawing({
  body: html`
    <div class="explorer-a et-surface--dark et-color--brand">
      <aside class="explorer-a__column et-surface--dark-elevated">
        <div class="explorer-a__head">
          <div class="explorer-a__project">
            <h1>${explorer.project}</h1>
            <button class="explorer-a__projects">
              Projects
              <span class="explorer-a__projects-count">${explorer.projects.length}</span>
              <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
            </button>
          </div>
          <div class="explorer-a__search">
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <span>${explorer.search}</span>
          </div>
        </div>

        <div class="explorer-a__groups">
          ${groups.map(
            (group) => html`
              <section class="explorer-a__group${group.collapsed && ' explorer-a__group--collapsed'}">
                <header class="explorer-a__group-head">
                  <span class="explorer-a__open">${group.open} open</span>
                  <b class="explorer-a__feature">${group.feature}</b>
                  ${group.collapsed && html`<span class="explorer-a__held">${group.calls.length} calls</span>`}
                  <button class="explorer-a__toggle">
                    <svg viewBox="0 0 24 24">
                      <path d="${group.collapsed ? 'm7 10 5 5 5-5' : 'm7 14 5-5 5 5'}" />
                    </svg>
                  </button>
                </header>
                ${!group.collapsed && html`<div class="explorer-a__calls">${group.calls.map(callRow)}</div>`}
              </section>
            `,
          )}
        </div>
      </aside>
    </div>
  `,
  styles: css`
    .explorer-a {
      display: grid;
      width: 100%;
      min-height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-a button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .explorer-a svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .explorer-a__column {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      align-content: start;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .explorer-a__head {
      display: grid;
      gap: 1.4rem;
      padding: 2rem 1.6rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .explorer-a__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .explorer-a__project h1 {
      margin: 0;
      font:
        500 2.4rem/1.15 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-a__projects {
      display: flex;
      gap: 0.6rem;
      align-items: center;
      padding: 0.5rem 0.8rem 0.5rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.4rem;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .explorer-a__projects-count {
      padding: 0 0.4rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.08);
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
    }
    .explorer-a__search {
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
    .explorer-a__groups {
      display: grid;
      align-content: start;
      gap: 1.6rem;
      padding: 1.6rem 0 2.4rem;
    }
    .explorer-a__group-head {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0 1rem 0.6rem 1.6rem;
    }
    .explorer-a__open {
      padding: 0.2rem 0.6rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.16);
      color: var(--et-theme-color-ink-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      white-space: nowrap;
    }
    .explorer-a__feature {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .explorer-a__held {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.1rem;
      white-space: nowrap;
    }
    .explorer-a__toggle {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-surface-color-rgb) / 0.06);
      color: var(--et-surface-color-muted-solid);
    }
    .explorer-a__group--collapsed .explorer-a__group-head {
      padding-bottom: 0;
    }
    .explorer-a__group--collapsed .explorer-a__open {
      background: rgb(var(--et-surface-color-rgb) / 0.08);
      color: var(--et-surface-color-subtle-solid);
    }
    .explorer-a__group--collapsed .explorer-a__feature {
      color: var(--et-surface-color-subtle-solid);
    }
    .explorer-a__call {
      display: grid;
      gap: 0.4rem;
      padding: 0.8rem 1.6rem;
      border-left: 0.3rem solid transparent;
    }
    .explorer-a__call-top {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .explorer-a__eyebrow,
    .explorer-a__settled {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .explorer-a__progress {
      display: flex;
      gap: 0.6rem;
      align-items: center;
    }
    .explorer-a__dots {
      display: flex;
      gap: 0.3rem;
      align-items: center;
    }
    .explorer-a__dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: rgb(var(--et-surface-color-rgb) / 0.18);
    }
    .explorer-a__dot--settled {
      background: rgb(var(--et-surface-color-rgb) / 0.5);
    }
    .explorer-a__headline {
      color: var(--et-surface-color-muted-solid);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .explorer-a__call--current {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.12);
    }
    .explorer-a__call--current .explorer-a__headline {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .explorer-a__call--current .explorer-a__eyebrow,
    .explorer-a__call--current .explorer-a__settled {
      color: var(--et-theme-color-ink-solid);
    }
    .explorer-a__call--current .explorer-a__dot {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.3);
    }
    .explorer-a__call--current .explorer-a__dot--settled {
      background: var(--et-theme-color-primary-solid);
    }
  `,
});
