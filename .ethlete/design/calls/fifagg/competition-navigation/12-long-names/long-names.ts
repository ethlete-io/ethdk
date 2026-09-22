import { css, drawing, html } from '@design-explore';
import { BANNER, COMPETITION, CURRENT, DESTINATION_COUNT, LIVE } from './fixture';

/** How the row carries the competition when the name is long and no icon asset exists. */
export type NameRule = 'stacked' | 'live-only' | 'banner';

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

const logo = html`<span class="logo">FIFA<i>e</i></span>`;

const desktopBar = html`
  <header class="bar">
    ${logo}
    <button class="zone" type="button">${padIcon}<span>GAMING</span></button>
    <button class="zone zone--on" type="button">${laurelIcon}<span>ESPORTS</span></button>
    <span class="grow"></span>
    <button class="search" type="button">${searchIcon}<span>Search</span><kbd>ctrl</kbd><kbd>↵</kbd></button>
    <button class="login" type="button"><span>Login</span></button>
  </header>
`;

const mobileBar = html`
  <header class="bar bar--m">
    ${logo}
    <span class="grow"></span>
    <button class="icon" type="button" aria-label="Search">${searchIcon}</button>
    <button class="burger" type="button" aria-label="Menu"><i></i><i></i><i></i></button>
  </header>
`;

const mapControl = (label: string) => html`
  <button class="map" type="button">
    <span class="map__grid"><i></i><i></i><i></i><i></i></span>
    ${label && html`<span>${label}</span>`}
    <i class="map__count">${DESTINATION_COUNT}</i>
  </button>
`;

const liveLine = html`
  <span class="live-line"
    ><span class="dot"></span><b>${LIVE.name}</b><span class="live-line__detail">is live now</span></span
  >
`;

const liveChip = html`
  <button class="live" type="button">
    <span class="dot"></span>
    <span class="live__text"><small>LIVE NOW</small><b>${LIVE.name}</b></span>
    <em>⌄</em>
  </button>
`;

const currentChip = html`<span class="current"><small>YOU ARE ON</small><b>${CURRENT}</b></span>`;

const subRow = (rule: NameRule, mobile: boolean) => {
  if (rule === 'stacked') {
    return html`
      <nav class="sub sub--stacked">
        <button class="whole" type="button">
          <span class="whole__name">${COMPETITION.name}</span>
          ${liveLine}
        </button>
        ${!mobile && currentChip} ${mapControl(mobile ? '' : 'Competition')}
      </nav>
    `;
  }

  if (rule === 'live-only') {
    return html`
      <nav class="sub">
        ${liveChip}
        <span class="grow"></span>
        ${!mobile && currentChip} ${mapControl(mobile ? '' : 'Competition')}
      </nav>
    `;
  }

  return html`
    <nav class="sub sub--banner">
      <span class="sub__art"></span>
      <span class="banner-name"><small>${COMPETITION.eyebrow}</small><b>${COMPETITION.name}</b></span>
      <span class="grow"></span>
      ${liveChip} ${mapControl('')}
    </nav>
  `;
};

/**
 * The chosen row, drawn with the longest real competition name and no icon asset. Only `rule`
 * changes: how the row carries the competition.
 */
export const longNames = ({ rule }: { rule: NameRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
        <section class="view">
          <small class="tag">DESKTOP · 1400</small>
          <div class="stack">${desktopBar} ${subRow(rule, false)}</div>
          <div class="peek">
            <small>Hosted by FIFAe</small>
            <b>${COMPETITION.name}</b>
            <span></span>
          </div>
        </section>

        <section class="view">
          <small class="tag">MOBILE · 390</small>
          <div class="phone">
            <div class="stack">${mobileBar} ${subRow(rule, true)}</div>
            <div class="peek peek--m">
              <small>Hosted by FIFAe</small>
              <b>${COMPETITION.name}</b>
              <span></span>
            </div>
          </div>
        </section>
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
        padding-bottom: 24px;
        background: #12171e;
        color: var(--ink);
        font-family: Jost, system-ui, sans-serif;
        font-size: 15px;
      }

      .view {
        padding: 12px 30px 0;
      }

      .tag {
        display: block;
        padding-bottom: 8px;
        color: #5d6573;
        font-size: 10px;
        letter-spacing: 0.18em;
      }

      .phone {
        width: 390px;
        padding-bottom: 12px;
        border-radius: 22px;
        background: #0a0d10;
      }

      .stack {
        border-radius: 20px;
        background: var(--card);
        overflow: hidden;
      }

      .phone .stack {
        margin: 8px;
        border-radius: 14px;
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 60px;
        padding-inline: 18px;
      }

      .bar--m {
        height: 52px;
        padding-inline: 12px;
      }

      .logo {
        margin-right: 18px;
        font-weight: 500;
        font-size: 26px;
        letter-spacing: 0.04em;
      }

      .bar--m .logo {
        margin-right: 0;
        font-size: 21px;
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

      .bar--m .logo i {
        font-size: 12px;
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
      .map,
      .icon,
      .burger {
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

      .icon {
        width: 34px;
        height: 34px;
        justify-content: center;
        border-radius: 9px;
        color: var(--muted);
      }

      .burger {
        flex-direction: column;
        gap: 4px;
        width: 34px;
        height: 34px;
        justify-content: center;
      }

      .burger i {
        width: 16px;
        height: 1.5px;
        background: var(--ink);
      }

      .sub {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 54px;
        padding: 0 14px;
        border-top: 1px solid var(--line);
      }

      .phone .sub {
        gap: 8px;
        min-height: 48px;
        padding: 0 8px;
      }

      .sub--stacked {
        padding-block: 8px;
      }

      .whole {
        display: grid;
        flex: 1;
        gap: 2px;
        min-width: 0;
        padding: 4px 6px;
        border-radius: 10px;
        text-align: left;
      }

      .whole__name {
        overflow: hidden;
        font-weight: 500;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .live-line {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        font-size: 12px;
      }

      .live-line b {
        overflow: hidden;
        color: var(--accent);
        font-weight: 400;
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
        background: var(--accent);
        box-shadow: 0 0 0 4px rgba(0, 252, 6, 0.16);
      }

      .live {
        min-width: 0;
        padding: 5px 10px;
        border: 1px solid rgba(0, 252, 6, 0.3);
        border-radius: 10px;
        background: rgba(0, 252, 6, 0.08);
      }

      .live__text {
        display: grid;
        min-width: 0;
        text-align: left;
      }

      .live__text small {
        color: var(--accent);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .live__text b,
      .current b {
        overflow: hidden;
        font-weight: 500;
        font-size: 14px;
        line-height: 1.2;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .live em {
        flex: none;
        font-style: normal;
        color: var(--muted);
      }

      .current {
        display: grid;
        flex: none;
        padding-inline: 2px;
        text-align: left;
      }

      .current small {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .map {
        flex: none;
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

      .sub--banner {
        min-height: 62px;
      }

      .phone .sub--banner {
        min-height: 56px;
      }

      .sub__art {
        position: absolute;
        inset: 0;
        background: ${BANNER};
      }

      .sub__art::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(18, 23, 30, 0.72), rgba(18, 23, 30, 0.92));
      }

      .banner-name {
        position: relative;
        display: grid;
        min-width: 0;
        gap: 1px;
      }

      .banner-name small {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .banner-name b {
        overflow: hidden;
        font-weight: 500;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sub--banner .live,
      .sub--banner .map {
        position: relative;
      }

      .peek {
        display: grid;
        gap: 10px;
        margin: 14px 0 0;
        padding: 22px 18px;
        border-radius: 14px;
        background: radial-gradient(120% 130% at 50% 0%, #0f2a18, #12171e 70%);
      }

      .peek--m {
        margin: 0 8px;
        padding: 16px 14px;
      }

      .peek small {
        color: var(--muted);
        font-size: 12px;
      }

      .peek b {
        font-weight: 500;
        font-size: 26px;
      }

      .peek--m b {
        font-size: 19px;
      }

      .peek span {
        height: 10px;
        width: 60%;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.06);
      }
    `,
  });
