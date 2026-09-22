import { css, drawing, html } from '@design-explore';
import { COMPETITION, MENU_DESTINATIONS, VISIBLE_DESTINATIONS } from './fixture';

/** Where the competition row sits in relation to the floating global header. */
export type Attachment = 'inside' | 'below' | 'band';

const searchIcon = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.6 15.6 4.9 4.9" />
  </svg>
`;

const padIcon = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2.5" y="7.5" width="19" height="11" rx="5.5" />
    <path d="M7 11v4M5 13h4M16 12.5h.01M18.5 15h.01" />
  </svg>
`;

const laurelIcon = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="10" r="5.5" />
    <path d="M9 15.5 7.5 21l4.5-2.5 4.5 2.5-1.5-5.5" />
  </svg>
`;

/**
 * The competition page under the FIFAe global header, with the destination strip moved up into a
 * row attached to that header. Only `attach` changes: where the row sits.
 */
export const subNavPage = ({ attach }: { attach: Attachment }) =>
  drawing({
    body: html`
      <div class="page" data-attach="${attach}">
        <div class="stack">
          <header class="bar">
            <span class="logo">FIFA<i>e</i></span>
            <button class="zone" type="button">${padIcon}<span>GAMING</span></button>
            <button class="zone zone--on" type="button">${laurelIcon}<span>ESPORTS</span></button>
            <span class="grow"></span>
            <button class="search" type="button">
              ${searchIcon}<span>Search</span><kbd>ctrl</kbd><kbd>↵</kbd>
            </button>
            <button class="login" type="button"><span>Login</span></button>
          </header>

          <nav class="sub">
            <button class="ident" type="button">
              <span class="mark">${COMPETITION.mark}</span>
              <span class="ident__text">
                <small>${COMPETITION.eyebrow}</small>
                <b>${COMPETITION.name}</b>
              </span>
            </button>
            <span class="rule"></span>
            <div class="links">
              ${VISIBLE_DESTINATIONS.map(
                (label, index) => html`<a class="${index === 0 ? 'is-current' : ''}">${label}</a>`,
              )}
            </div>
            <button class="more" type="button">
              <span>More</span><em>⌄</em><i class="more__count">${MENU_DESTINATIONS.length}</i>
            </button>
          </nav>
        </div>

        <main class="body">
          <section class="hero">
            <span class="hero__art"></span>
            <div class="hero__text">
              <h1>FIFAe World Cup 2026™ ft. eFootball™ Console</h1>
              <small>Hosted by FIFAe</small>
            </div>
          </section>
          <aside class="news">
            <span class="news__art"></span>
            <p>The FIFAe Continental Champions of Europe for eFootball™ Console are <b>POLAND</b>.</p>
            <small>12 days ago · by FIFAe</small>
          </aside>
        </main>
      </div>
    `,
    styles: css`
      :root {
        color-scheme: dark;
      }

      body {
        margin: 0;
        background: #0a0c11;
      }

      .page {
        --card: #161a22;
        --line: #272c37;
        --ink: #e9ecf2;
        --muted: #949bab;
        --accent: #00e06a;
        --blue: #1d7bf5;
        width: 1400px;
        padding-bottom: 28px;
        background: #0a0c11;
        color: var(--ink);
        font-family: Jost, system-ui, sans-serif;
        font-size: 15px;
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 64px;
        padding-inline: 18px;
      }

      .logo {
        margin-right: 18px;
        font-weight: 500;
        font-size: 26px;
        letter-spacing: 0.04em;
      }

      .logo i {
        display: inline-block;
        margin-left: 3px;
        padding: 1px 5px;
        border: 1px solid var(--ink);
        border-radius: 3px;
        font-style: normal;
        font-size: 15px;
      }

      .zone,
      .search,
      .login,
      .ident,
      .more {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }

      .zone {
        padding: 8px 14px;
        border-radius: 10px;
        color: var(--muted);
        letter-spacing: 0.06em;
      }

      .zone--on {
        color: var(--ink);
      }

      .zone svg,
      .search svg {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
      }

      .grow {
        flex: 1;
      }

      .search {
        width: 250px;
        height: 40px;
        padding-inline: 14px;
        border-radius: 10px;
        background: #0e1117;
        color: var(--muted);
      }

      .search span {
        flex: 1;
        text-align: left;
      }

      kbd {
        padding: 2px 6px;
        border-radius: 5px;
        background: #1d222c;
        color: var(--muted);
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
      }

      .login {
        height: 40px;
        margin-left: 12px;
        padding-inline: 20px;
        border-radius: 10px;
        background: var(--blue);
        color: #fff;
      }

      .sub {
        display: flex;
        align-items: center;
        gap: 14px;
        height: 54px;
        padding-inline: 18px;
      }

      .ident {
        gap: 10px;
        padding: 4px 8px 4px 4px;
        border-radius: 10px;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: linear-gradient(140deg, var(--accent), #0a9d4d);
        color: #06210f;
        font-weight: 500;
        font-size: 14px;
      }

      .ident__text {
        display: grid;
        text-align: left;
      }

      .ident__text small {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .ident__text b {
        font-weight: 500;
        font-size: 14px;
        line-height: 1.2;
      }

      .rule {
        width: 1px;
        height: 24px;
        background: var(--line);
      }

      .links {
        display: flex;
        flex: 1;
        gap: 4px;
        overflow: hidden;
      }

      .links a {
        padding: 7px 12px;
        border-radius: 8px;
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .links a.is-current {
        box-shadow: inset 0 -2px 0 var(--accent);
        color: var(--ink);
      }

      .more {
        padding: 7px 12px;
        border-radius: 8px;
        background: #1d222c;
        color: var(--ink);
        font-size: 14px;
      }

      .more em {
        font-style: normal;
        color: var(--muted);
      }

      .more__count {
        display: grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        background: #2b313d;
        color: var(--muted);
        font-style: normal;
        font-size: 11px;
      }

      [data-attach='inside'] .stack {
        margin: 20px;
        border-radius: 18px;
        background: var(--card);
        overflow: hidden;
      }

      [data-attach='inside'] .sub {
        border-top: 1px solid var(--line);
      }

      [data-attach='below'] .bar {
        margin: 20px 20px 0;
        border-radius: 18px;
        background: var(--card);
      }

      [data-attach='below'] .sub {
        margin: 8px 20px 0;
        border: 1px solid rgba(0, 224, 106, 0.22);
        border-radius: 14px;
        background: linear-gradient(90deg, rgba(0, 224, 106, 0.1), rgba(0, 224, 106, 0.02) 40%, var(--card));
      }

      [data-attach='band'] .bar {
        margin: 20px 20px 16px;
        border-radius: 18px;
        background: var(--card);
      }

      [data-attach='band'] .sub {
        height: 58px;
        padding-inline: 38px;
        border-block: 1px solid var(--line);
        background: #101319;
      }

      .body {
        display: flex;
        gap: 16px;
        margin: 16px 20px 0;
      }

      .hero {
        position: relative;
        display: flex;
        flex: 1;
        align-items: flex-end;
        height: 320px;
        padding: 26px;
        border-radius: 14px;
        background: radial-gradient(120% 130% at 50% 10%, #113a24, #0b1017 70%);
        overflow: hidden;
      }

      .hero__art {
        position: absolute;
        inset: auto 50% 0 auto;
        width: 300px;
        height: 240px;
        transform: translateX(50%);
        background: linear-gradient(180deg, rgba(0, 224, 106, 0.22), rgba(0, 224, 106, 0));
        clip-path: polygon(38% 0, 62% 0, 74% 100%, 26% 100%);
      }

      .hero__text {
        position: relative;
        display: grid;
        gap: 4px;
      }

      .hero h1 {
        margin: 0;
        font-weight: 500;
        font-size: 30px;
      }

      .hero small,
      .news small {
        color: var(--muted);
        font-size: 12px;
      }

      .news {
        display: grid;
        gap: 10px;
        align-content: start;
        width: 330px;
        padding-bottom: 14px;
        border-radius: 14px;
        background: var(--card);
        overflow: hidden;
      }

      .news__art {
        height: 150px;
        background: linear-gradient(140deg, #2a3140, #171b23);
      }

      .news p {
        margin: 0 16px;
        font-size: 14px;
        line-height: 1.45;
      }

      .news p b {
        color: var(--accent);
        font-weight: 500;
      }

      .news small {
        margin: 0 16px;
      }
    `,
  });
