import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, DESTINATION_COUNT, LIVE, PAGES } from './fixture';

/** How the desktop row spends the width the two-line mobile shape does not need. */
export type DesktopRule = 'one-line' | 'right-cluster' | 'pages-inline';

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

const competitionButton = html`
  <button class="map" type="button">
    <span class="map__grid"><i></i><i></i><i></i><i></i></span>
    <span>Competition</span>
    <i class="map__count">${DESTINATION_COUNT}</i>
    <em>⌄</em>
  </button>
`;

const name = html`<span class="name">${COMPETITION.name}</span>`;

const statusLine = html`
  <span class="status">
    <span class="dot"></span>
    <b>${LIVE.name}</b>
    <span class="status__detail">is live now · ${LIVE.detail}</span>
  </span>
`;

const statusChip = html`
  <button class="live" type="button">
    <span class="dot"></span>
    <span class="live__text"><small>LIVE NOW</small><b>${LIVE.name}</b></span>
    <em>⌄</em>
  </button>
`;

const pageLinks = html`
  <div class="links">${PAGES.map((page) => html`<a class="${page === CURRENT ? 'is-current' : ''}">${page}</a>`)}</div>
`;

const subRow = (rule: DesktopRule) => {
  if (rule === 'one-line') {
    return html`
      <nav class="sub">
        ${name}
        <span class="rule"></span>
        ${statusLine}
        <span class="grow"></span>
        ${competitionButton}
      </nav>
    `;
  }

  if (rule === 'pages-inline') {
    return html`
      <nav class="sub">
        ${name}
        <span class="rule"></span>
        ${pageLinks}
        <span class="grow"></span>
        ${statusChip} ${competitionButton}
      </nav>
    `;
  }

  return html`
    <nav class="sub">
      ${name}
      <span class="grow"></span>
      ${statusChip} ${competitionButton}
    </nav>
  `;
};

/**
 * The desktop half of the chosen row, without the two-line shape the phone needs and without the
 * "you are on" label. Only `rule` changes: what the row does with the width.
 */
export const desktopRow = ({ rule }: { rule: DesktopRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
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
        --accent: #00fc06;
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
      .live,
      .map {
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
        min-height: 54px;
        padding: 0 18px;
        border-top: 1px solid var(--line);
        background: linear-gradient(90deg, rgba(0, 252, 6, 0.12), rgba(0, 252, 6, 0.03) 38%, rgba(0, 252, 6, 0) 62%);
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

      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .status b {
        font-weight: 500;
        color: var(--accent);
      }

      .status__detail {
        color: var(--muted);
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 4px rgba(0, 252, 6, 0.16);
      }

      .live {
        padding: 5px 10px;
        border: 1px solid rgba(0, 252, 6, 0.3);
        border-radius: 10px;
        background: rgba(0, 252, 6, 0.08);
      }

      .live__text {
        display: grid;
        text-align: left;
      }

      .live__text small {
        color: var(--accent);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .live__text b {
        font-weight: 500;
        font-size: 14px;
        line-height: 1.2;
        white-space: nowrap;
      }

      .live em,
      .map em {
        font-style: normal;
        color: var(--muted);
      }

      .links {
        display: flex;
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
        box-shadow: inset 0 -2px 0 var(--accent);
        color: var(--ink);
      }

      .map {
        height: 36px;
        padding-inline: 12px;
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
      }

      .map__grid {
        display: grid;
        grid-template-columns: repeat(2, 5px);
        gap: 3px;
      }

      .map__grid i {
        width: 5px;
        height: 5px;
        border-radius: 1px;
        background: var(--muted);
      }

      .map__count {
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
