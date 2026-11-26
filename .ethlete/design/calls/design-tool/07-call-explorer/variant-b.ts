import { css, drawing, html } from '@design-explore';
import { ExplorerCall, explorer } from './explorer';

/** `touched` is prose, so newest-first order cannot be read off the value itself. */
const FRESHNESS = [
  '2 minutes ago',
  '18 minutes ago',
  '3 hours ago',
  '5 hours ago',
  'yesterday',
  '2 days ago',
  '4 days ago',
  'last week',
];

const freshness = (call: ExplorerCall) => {
  const index = FRESHNESS.indexOf(call.touched);

  return index === -1 ? FRESHNESS.length : index;
};

const openCalls = explorer.calls
  .filter((call) => call.settled < call.rounds)
  .sort((left, right) => freshness(left) - freshness(right));

const settledGroups = explorer.features
  .map((feature) => ({
    feature,
    calls: explorer.calls.filter((call) => call.feature === feature && call.settled === call.rounds),
  }))
  .filter((group) => group.calls.length > 0);

const expanded = settledGroups[0]?.feature;
const settledCount = settledGroups.reduce((total, group) => total + group.calls.length, 0);

const rounds = (call: ExplorerCall) => html`
  <span class="explorer-b__pips">
    ${Array.from(
      { length: call.rounds },
      (_, index) => html`<i class="explorer-b__pip${index < call.settled && ' explorer-b__pip--settled'}"></i>`,
    )}
  </span>
  <span class="explorer-b__count">${call.settled} of ${call.rounds}</span>
`;

export default drawing({
  body: html`
    <div class="explorer-b et-surface--dark-elevated et-color--brand">
      <header class="explorer-b__head">
        <div class="explorer-b__project">
          <h1>${explorer.project}</h1>
          <button class="explorer-b__projects">
            Projects
            <span class="explorer-b__projects-count">${explorer.projects.length}</span>
            <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
          </button>
        </div>
        <div class="explorer-b__search">
          <svg viewBox="0 0 24 24">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <span>${explorer.search}</span>
        </div>
      </header>

      <div class="explorer-b__list">
        <section class="explorer-b__section">
          <header class="explorer-b__section-head">
            <b>Open</b>
            <span>${openCalls.length}</span>
          </header>

          ${openCalls.map(
            (call) => html`
              <article class="explorer-b__row${call.open && ' explorer-b__row--current'}">
                <div class="explorer-b__row-head">
                  <span class="explorer-b__eyebrow">${call.eyebrow}</span>
                  <span class="explorer-b__touched">${call.touched}</span>
                </div>
                <b>${call.headline}</b>
                <div class="explorer-b__row-foot">
                  <span class="explorer-b__tag">${call.feature}</span>
                  ${rounds(call)}
                </div>
              </article>
            `,
          )}
        </section>

        <section class="explorer-b__section explorer-b__section--settled">
          <header class="explorer-b__section-head">
            <b>Settled</b>
            <span>${settledCount}</span>
          </header>

          ${settledGroups.map(
            (group) => html`
              <section class="explorer-b__group${group.feature === expanded && ' explorer-b__group--expanded'}">
                <button class="explorer-b__group-head">
                  <svg viewBox="0 0 24 24"><path d="m10 7 5 5-5 5" /></svg>
                  <b>${group.feature}</b>
                  <span>${group.calls.length}</span>
                </button>

                ${
                  group.feature === expanded &&
                  group.calls.map(
                    (call) => html`
                      <article class="explorer-b__row explorer-b__row--settled">
                        <div class="explorer-b__row-head">
                          <span class="explorer-b__eyebrow">${call.eyebrow}</span>
                          <span class="explorer-b__touched">${call.touched}</span>
                        </div>
                        <b>${call.headline}</b>
                        <div class="explorer-b__row-foot">${rounds(call)}</div>
                      </article>
                    `,
                  )
                }
              </section>
            `,
          )}
        </section>
      </div>
    </div>
  `,
  styles: css`
    .explorer-b {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: 42rem;
      height: 90rem;
      background: var(--et-surface-background);
      color: var(--et-surface-text);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-b button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .explorer-b svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .explorer-b__head {
      display: grid;
      gap: 1.4rem;
      padding: 2rem 1.6rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border);
    }
    .explorer-b__project {
      display: flex;
      gap: 1.2rem;
      align-items: center;
      justify-content: space-between;
    }
    .explorer-b__project h1 {
      margin: 0;
      font:
        500 2.4rem/1.15 'Jost',
        system-ui,
        sans-serif;
    }
    .explorer-b__projects {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem 0.9rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.4rem;
      color: var(--et-surface-text-muted);
      font-size: 1.2rem;
    }
    .explorer-b__projects-count {
      padding: 0 0.5rem;
      border-radius: 0.9rem;
      background: color-mix(in srgb, var(--et-surface-text) 10%, transparent);
      color: var(--et-surface-text-subtle);
      font-size: 1.1rem;
    }
    .explorer-b__search {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      padding: 0.8rem 1rem;
      border: 0.1rem solid var(--et-surface-border);
      border-radius: 0.6rem;
      background: color-mix(in srgb, var(--et-surface-text) 4%, transparent);
      color: var(--et-surface-text-subtle);
      font-size: 1.3rem;
    }
    .explorer-b__list {
      display: grid;
      align-content: start;
      min-height: 0;
      padding-bottom: 1.6rem;
      overflow: hidden;
    }
    .explorer-b__section-head {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      padding: 1.6rem 1.6rem 0.6rem;
    }
    .explorer-b__section-head b {
      color: var(--et-surface-text-muted);
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .explorer-b__section-head span {
      padding: 0 0.6rem;
      border-radius: 0.9rem;
      background: color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      color: var(--et-surface-text-subtle);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }
    .explorer-b__section--settled {
      margin-top: 0.8rem;
      border-top: 0.1rem solid var(--et-surface-border);
    }
    .explorer-b__row {
      display: grid;
      gap: 0.4rem;
      padding: 0.9rem 1.6rem;
      border-left: 0.2rem solid transparent;
    }
    .explorer-b__row b {
      display: -webkit-box;
      color: var(--et-surface-text-muted);
      font-weight: 400;
      font-size: 1.3rem;
      line-height: 1.35;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .explorer-b__row-head,
    .explorer-b__row-foot {
      display: flex;
      gap: 0.8rem;
      align-items: center;
    }
    .explorer-b__row-head {
      justify-content: space-between;
    }
    .explorer-b__eyebrow,
    .explorer-b__touched,
    .explorer-b__count {
      color: var(--et-surface-text-subtle);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .explorer-b__tag {
      padding: 0.1rem 0.6rem;
      border-radius: 0.3rem;
      background: color-mix(in srgb, var(--et-surface-text) 8%, transparent);
      color: var(--et-surface-text-muted);
      font-size: 1.1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .explorer-b__row-foot .explorer-b__count {
      margin-left: auto;
    }
    .explorer-b__pips {
      display: flex;
      gap: 0.3rem;
      align-items: center;
    }
    .explorer-b__pip {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--et-surface-text) 20%, transparent);
    }
    .explorer-b__pip--settled {
      background: var(--et-surface-text-muted);
    }
    .explorer-b__row--current {
      border-left-color: var(--et-tone-fill);
      background: color-mix(in srgb, var(--et-tone-fill) 12%, transparent);
    }
    .explorer-b__row--current b {
      color: var(--et-surface-text);
      font-weight: 500;
    }
    .explorer-b__row--current .explorer-b__eyebrow,
    .explorer-b__row--current .explorer-b__count {
      color: var(--et-tone-text);
    }
    .explorer-b__row--current .explorer-b__tag {
      background: var(--et-tone-fill);
      color: var(--et-tone-on-fill);
    }
    .explorer-b__row--current .explorer-b__pip {
      background: color-mix(in srgb, var(--et-tone-fill) 30%, transparent);
    }
    .explorer-b__row--current .explorer-b__pip--settled {
      background: var(--et-tone-fill);
    }
    .explorer-b__group-head {
      display: flex;
      gap: 0.8rem;
      align-items: center;
      width: 100%;
      padding: 0.9rem 1.6rem;
      text-align: left;
    }
    .explorer-b__group-head b {
      color: var(--et-surface-text-muted);
      font-weight: 500;
      font-size: 1.3rem;
    }
    .explorer-b__group-head span {
      margin-left: auto;
      color: var(--et-surface-text-subtle);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
    }
    .explorer-b__group-head svg {
      width: 1.2rem;
      height: 1.2rem;
      color: var(--et-surface-text-subtle);
    }
    .explorer-b__group--expanded {
      background: color-mix(in srgb, var(--et-surface-text) 3%, transparent);
    }
    .explorer-b__group--expanded .explorer-b__group-head svg {
      transform: rotate(90deg);
      color: var(--et-surface-text-muted);
    }
    .explorer-b__group--expanded .explorer-b__group-head b {
      color: var(--et-surface-text);
    }
    .explorer-b__row--settled {
      gap: 0.3rem;
      padding: 0.6rem 1.6rem 0.8rem 3.6rem;
    }
    .explorer-b__row--settled b {
      color: var(--et-surface-text-subtle);
      -webkit-line-clamp: 1;
    }
  `,
});
