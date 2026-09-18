import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, DESTINATION_COUNT, LIVE, PAGES } from './fixture';

/** How the row marks the page you are on. */
export type ActiveRule = 'tab' | 'pill' | 'weight';

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

const desktopBar = html`
  <header class="bar">
    <span class="logo">FIFA<i>e</i></span>
    <button class="zone" type="button">${padIcon}<span>GAMING</span></button>
    <button class="zone zone--on" type="button">${laurelIcon}<span>ESPORTS</span></button>
    <span class="grow"></span>
    <button class="search" type="button">${searchIcon}<span>Search</span><kbd>ctrl</kbd><kbd>↵</kbd></button>
    <button class="login" type="button"><span>Login</span></button>
  </header>
`;

const liveControl = html`
  <button class="ctl ctl--live" type="button">
    <span class="dot"></span>
    <span>${LIVE.name}</span>
    <em>⌄</em>
  </button>
`;

const competitionButton = html`
  <button class="ctl" type="button">
    <span class="ctl__grid"><i></i><i></i><i></i><i></i></span>
    <span>Competition</span>
    <i class="ctl__count">${DESTINATION_COUNT}</i>
    <em>⌄</em>
  </button>
`;

const subRow = html`
  <nav class="sub">
    <span class="name">${COMPETITION.name}</span>
    <span class="rule"></span>
    <div class="links">
      ${PAGES.map((page) => html`<a class="${page === CURRENT ? 'is-current' : ''}"><span>${page}</span></a>`)}
    </div>
    <span class="grow"></span>
    ${liveControl} ${competitionButton}
  </nav>
`;

/**
 * The chosen desktop row, with the two right controls built to one size. Only `rule` changes: how
 * the row marks the page you are on.
 */
export const activeState = ({ rule }: { rule: ActiveRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
        <div class="stack">${desktopBar} ${subRow}</div>
        <div class="peek">
          <small>Hosted by FIFAe</small>
          <b>${COMPETITION.name}</b>
          <span></span>
        </div>
      </div>
    `,
    styles: css`
      :root {
        color-scheme: dark;
      }

      body {
        margin: 0;
        background: #12171e;
      }

      .page {
        --card: #19222d;
        --line: #283140;
        --ink: #e9ecf2;
        --muted: #949bab;
        --primary: 0 252 6;
        --accent: rgb(var(--primary));
        --blue: #1d7bf5;
        width: 1400px;
        padding: 20px 30px 24px;
        background: #12171e;
        color: var(--ink);
        font-family: Jost, system-ui, sans-serif;
        font-size: 15px;
      }

      .stack {
        border-radius: 20px;
        background: var(--card);
        overflow: hidden;
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 60px;
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

      button {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }

      .zone,
      .search,
      .login,
      .ctl {
        display: flex;
        align-items: center;
        gap: 8px;
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

      svg {
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
        background: #12171e;
        color: var(--muted);
      }

      .search span {
        flex: 1;
        text-align: left;
      }

      kbd {
        padding: 2px 6px;
        border-radius: 5px;
        background: #1f2937;
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
        align-items: stretch;
        gap: 14px;
        min-height: 56px;
        padding: 0 18px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .sub > * {
        align-self: center;
      }

      .name {
        font-weight: 500;
        font-size: 15px;
        white-space: nowrap;
      }

      .rule {
        width: 1px;
        height: 22px;
        background: var(--line);
      }

      .links {
        display: flex;
        align-self: stretch;
        gap: 4px;
      }

      .links a {
        display: flex;
        align-items: center;
        padding: 0 14px;
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      [data-rule='tab'] .links a.is-current {
        border-radius: 10px 10px 0 0;
        background: linear-gradient(180deg, rgb(var(--primary) / 0.14), rgb(var(--primary) / 0.05)), #202a37;
        color: var(--ink);
      }

      [data-rule='pill'] .links a {
        margin-block: 10px;
        border-radius: 10px;
      }

      [data-rule='pill'] .links a.is-current {
        background: rgb(var(--primary) / 0.14);
        color: var(--ink);
      }

      [data-rule='weight'] .links a.is-current {
        color: var(--ink);
        font-weight: 500;
      }

      [data-rule='weight'] .links a.is-current::before {
        content: '';
        width: 6px;
        height: 6px;
        margin-right: 8px;
        border-radius: 50%;
        background: var(--accent);
      }

      .ctl {
        height: 36px;
        padding-inline: 12px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
        white-space: nowrap;
      }

      .ctl--live {
        border-color: rgb(var(--primary) / 0.28);
        background: rgb(var(--primary) / 0.1);
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
      }

      .ctl em {
        font-style: normal;
        color: var(--muted);
      }

      .ctl__grid {
        display: grid;
        grid-template-columns: repeat(2, 5px);
        gap: 3px;
      }

      .ctl__grid i {
        width: 5px;
        height: 5px;
        border-radius: 1px;
        background: var(--muted);
      }

      .ctl__count {
        display: grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        background: #283140;
        color: var(--muted);
        font-style: normal;
        font-size: 11px;
      }

      .peek {
        display: grid;
        gap: 10px;
        margin-top: 14px;
        padding: 22px 18px;
        border-radius: 14px;
        background: radial-gradient(120% 130% at 50% 0%, #0f2a18, #12171e 70%);
      }

      .peek small {
        color: var(--muted);
        font-size: 12px;
      }

      .peek b {
        font-weight: 500;
        font-size: 26px;
      }

      .peek span {
        width: 60%;
        height: 10px;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.06);
      }
    `,
  });
