import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, LIVE, PAGES } from './fixture';

/** What the desktop row does with the width the phone row does not have. */
export type DesktopRule =
  'stretched' | 'pages-between' | 'named-control' | 'strip-left' | 'chip-leads' | 'chip-in-strip';

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

const grid = html`<span class="grid"><i></i><i></i><i></i><i></i></span>`;

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

const chip = html`
  <button class="chip" type="button">
    <span class="dot"></span>
    <b>${LIVE.name}</b>
    <span class="chip__detail">${LIVE.detail}</span>
  </button>
`;

const pageLinks = html`
  <div class="links">${PAGES.map((page) => html`<a class="${page === CURRENT ? 'is-current' : ''}">${page}</a>`)}</div>
`;

const square = html` <button class="square" type="button" aria-label="All of the competition">${grid}</button> `;

const stageEntry = html` <a class="links__stage"><span class="dot"></span>${LIVE.name}</a> `;

const subRow = (rule: DesktopRule) => {
  if (rule === 'strip-left') {
    return html`
      <nav class="sub">
        ${pageLinks}
        <span class="grow"></span>
        ${chip} ${square}
      </nav>
    `;
  }

  if (rule === 'chip-leads') {
    return html`
      <nav class="sub">
        ${chip} ${pageLinks}
        <span class="grow"></span>
        ${square}
      </nav>
    `;
  }

  if (rule === 'chip-in-strip') {
    return html`
      <nav class="sub">
        <div class="links">${stageEntry}${pageLinks}</div>
        <span class="grow"></span>
        ${square}
      </nav>
    `;
  }

  if (rule === 'pages-between') {
    return html`
      <nav class="sub">
        ${chip}
        <span class="grow"></span>
        ${pageLinks}
        <span class="grow"></span>
        <button class="square" type="button" aria-label="All of the competition">${grid}</button>
      </nav>
    `;
  }

  if (rule === 'named-control') {
    return html`
      <nav class="sub">
        ${chip}
        <span class="grow"></span>
        <button class="named" type="button">${grid}<span>All of the competition</span></button>
      </nav>
    `;
  }

  return html`
    <nav class="sub">
      ${chip}
      <span class="grow"></span>
      <button class="square" type="button" aria-label="All of the competition">${grid}</button>
    </nav>
  `;
};

/** The settled phone row at 1400px: one chip, one map control, and nothing the phone dropped. */
export const desktopRow = ({ rule }: { rule: DesktopRule }) =>
  drawing({
    body: html`
      <div class="page">
        <div class="stack">${desktopBar} ${subRow(rule)}</div>
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
      .chip,
      .named {
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
        align-items: center;
        gap: 14px;
        min-height: 56px;
        padding-block: 8px;
        padding-inline: 18px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .chip {
        min-width: 0;
        height: 40px;
        padding-inline: 12px;
        border: 1px solid rgb(var(--primary) / 0.28);
        border-radius: 10px;
        background: rgb(var(--primary) / 0.1);
      }

      .chip b {
        overflow: hidden;
        color: rgb(var(--primary));
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chip__detail {
        flex: none;
        color: var(--muted);
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgb(var(--primary));
        box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
      }

      .links {
        display: flex;
        flex: none;
        gap: 4px;
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
        box-shadow: inset 0 -2px 0 rgb(var(--primary));
        color: var(--ink);
      }

      .links .links {
        gap: 4px;
      }

      .links__stage {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-right: 6px;
        padding: 7px 12px;
        border: 1px solid rgb(var(--primary) / 0.28);
        border-radius: 8px;
        background: rgb(var(--primary) / 0.1);
        color: rgb(var(--primary));
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .square {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 40px;
        border-radius: 10px;
        background: #1f2937;
      }

      .named {
        flex: none;
        height: 40px;
        padding-inline: 14px;
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
      }

      .grid {
        display: grid;
        flex: none;
        grid-template-columns: repeat(2, 6px);
        gap: 3px;
      }

      .grid i {
        width: 6px;
        height: 6px;
        border-radius: 1px;
        background: var(--ink);
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
        height: 12px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.06);
      }
    `,
  });
