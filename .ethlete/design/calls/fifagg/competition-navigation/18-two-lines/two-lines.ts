import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, DESTINATION_COUNT, LIVE, PAGES } from './fixture';

/** What the two lines of the call 12 row say, now that the competition name has left it. */
export type LineRule = 'page-first' | 'live-first' | 'one-line';

const burgerIcon = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
`;

const searchIcon = html`
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.6 15.6 4.9 4.9" />
  </svg>
`;

const phoneBar = html`
  <header class="bar">
    <span class="logo">FIFA<i>e</i></span>
    <span class="grow"></span>
    <button class="icon" type="button" aria-label="Search">${searchIcon}</button>
    <button class="icon" type="button" aria-label="Menu">${burgerIcon}</button>
  </header>
`;

const mapControl = (label: string) => html`
  <button class="map" type="button">
    <span class="map__grid"><i></i><i></i><i></i><i></i></span>
    ${label && html`<span class="map__label">${label}</span>`}
    <i class="map__count">${DESTINATION_COUNT}</i>
  </button>
`;

const liveLine = html`
  <span class="live-line">
    <span class="dot"></span>
    <b>${LIVE.name}</b>
    <span class="live-line__detail">is live now</span>
  </span>
`;

const subRow = (rule: LineRule) => {
  if (rule === 'page-first') {
    return html`
      <nav class="sub">
        <button class="whole" type="button"><span class="whole__lead">${CURRENT}</span> ${liveLine}</button>
        ${mapControl('')}
      </nav>
    `;
  }

  if (rule === 'live-first') {
    return html`
      <nav class="sub">
        <button class="whole whole--live" type="button">
          ${liveLine}
          <span class="whole__rest">${CURRENT} · ${PAGES.length - 1} more pages</span>
        </button>
        ${mapControl('')}
      </nav>
    `;
  }

  return html`
    <nav class="sub">
      <button class="whole" type="button">${liveLine}</button>
      ${mapControl(CURRENT)}
    </nav>
  `;
};

/**
 * The call 12 row on the phone, with the competition name removed: a text block on the left and one
 * map control on the right. Only what the block says changes.
 */
export const twoLines = ({ rule }: { rule: LineRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
        <div class="stack">${phoneBar} ${subRow(rule)}</div>
        <div class="banner">
          <span class="banner__art">Cyprus Football Association Esports Competition<br />Featuring Rocket League™</span>
          <b>${COMPETITION.name}</b>
        </div>
        <div class="tabs"><a class="is-current">Overview</a><a>Tournament</a></div>
        <div class="body">
          <p>Welcome to the Official Rocket League Tournament on FIFA.GG - Republic of Cyprus.</p>
          <span></span>
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
        width: 390px;
        padding: 14px 15px 20px;
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
        gap: 2px;
        height: 60px;
        padding-inline: 16px;
      }

      .logo {
        font-weight: 500;
        font-size: 24px;
        letter-spacing: 0.04em;
      }

      .logo i {
        display: inline-block;
        margin-left: 3px;
        padding: 1px 5px;
        border: 1px solid var(--ink);
        border-radius: 3px;
        font-style: normal;
        font-size: 14px;
      }

      .grow {
        flex: 1;
      }

      button {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
      }

      .icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
      }

      .sub {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .whole {
        display: grid;
        flex: 1;
        gap: 3px;
        min-width: 0;
      }

      .whole__lead {
        font-weight: 500;
        font-size: 15px;
      }

      .whole__rest {
        color: var(--muted);
        font-size: 13px;
      }

      .live-line {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        font-size: 13px;
      }

      .whole--live .live-line {
        font-size: 15px;
      }

      .live-line b {
        overflow: hidden;
        color: rgb(var(--primary));
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .live-line__detail {
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

      .map {
        display: flex;
        flex: none;
        align-items: center;
        gap: 9px;
        height: 40px;
        padding-inline: 12px;
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
      }

      .map__label {
        font-weight: 500;
      }

      .map__grid {
        display: grid;
        grid-template-columns: repeat(2, 6px);
        gap: 3px;
      }

      .map__grid i {
        width: 6px;
        height: 6px;
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

      .banner {
        display: grid;
        grid-template-rows: 1fr auto;
        gap: 6px;
        height: 230px;
        margin-top: 12px;
        padding: 16px;
        border-radius: 16px;
        background: radial-gradient(120% 120% at 50% 20%, #12305c, #0c1524 70%);
      }

      .banner__art {
        align-self: start;
        margin-top: 34px;
        padding-inline: 24px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 11px;
        text-align: center;
      }

      .banner b {
        font-weight: 600;
        font-size: 26px;
        line-height: 1.15;
      }

      .tabs {
        display: flex;
        gap: 22px;
        margin-top: 16px;
        padding: 0 4px 10px;
        border-bottom: 1px solid var(--line);
        font-size: 17px;
      }

      .tabs a {
        color: var(--muted);
      }

      .tabs a.is-current {
        padding-bottom: 10px;
        border-bottom: 2px solid var(--ink);
        color: var(--ink);
        font-weight: 500;
      }

      .body {
        display: grid;
        gap: 10px;
        margin-top: 16px;
        color: var(--muted);
      }

      .body p {
        margin: 0;
        line-height: 1.5;
      }

      .body span {
        height: 10px;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.06);
      }

      .body span:last-child {
        width: 60%;
      }
    `,
  });
