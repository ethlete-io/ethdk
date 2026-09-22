import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, DESTINATIONS, LIVE } from './fixture';

/** What the second row of the header card holds when the destination list does not fit. */
export type RowRule = 'map' | 'live' | 'pinned';

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

const ident = (short: boolean) => html`
  <button class="ident" type="button">
    <span class="mark">${COMPETITION.mark}</span>
    <span class="ident__text">
      <small>${COMPETITION.eyebrow}</small>
      <b>${short ? COMPETITION.short : COMPETITION.name}</b>
    </span>
  </button>
`;

const liveChip = (short: boolean) => html`
  <button class="live" type="button">
    <span class="live__dot"></span>
    <span class="live__text">
      <small>${LIVE.label}</small>
      <b>${short ? LIVE.short : LIVE.name}</b>
    </span>
    <em>⌄</em>
  </button>
`;

const mapControl = (label: string) => html`
  <button class="map" type="button">
    <span class="map__grid"><i></i><i></i><i></i><i></i></span>
    <span>${label}</span>
    <i class="map__count">${DESTINATIONS.length}</i>
  </button>
`;

const currentChip = html`<span class="current"><small>YOU ARE ON</small><b>${CURRENT}</b></span>`;

const strip = (count: number) => html`
  <div class="strip">
    <div class="strip__track">
      ${DESTINATIONS.slice(0, count).map(
        (label, index) => html`<a class="${index === 0 ? 'is-current' : ''}">${label}</a>`,
      )}
    </div>
    <span class="strip__fade"></span>
    <button class="strip__next" type="button" aria-label="More destinations">›</button>
  </div>
`;

const subRow = (rule: RowRule, mobile: boolean) => {
  if (rule === 'map') {
    return html`
      <nav class="sub">
        ${ident(mobile)}
        <span class="rule"></span>
        ${currentChip}
        <span class="grow"></span>
        ${!mobile && liveChip(false)} ${mapControl(mobile ? '' : 'Competition')}
      </nav>
    `;
  }

  if (rule === 'live') {
    return html`
      <nav class="sub">
        ${ident(mobile)} ${liveChip(mobile)}
        <span class="grow"></span>
        ${!mobile && currentChip} ${mapControl(mobile ? '' : 'Competition')}
      </nav>
    `;
  }

  return html`
    <nav class="sub sub--pinned">
      <div class="sub__line">
        ${ident(mobile)}
        <span class="grow"></span>
        ${liveChip(mobile)} ${mobile && mapControl('')}
      </div>
      <div class="sub__line sub__line--strip">${strip(mobile ? 3 : 6)} ${!mobile && mapControl('')}</div>
    </nav>
  `;
};

/**
 * The two-row header card call 9 chose, drawn at both widths. Only `rule` changes: what the second
 * row holds once the seven destinations stop fitting.
 */
export const crowdedRow = ({ rule }: { rule: RowRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
        <section class="view">
          <small class="tag">DESKTOP · 1400</small>
          <div class="stack">${desktopBar} ${subRow(rule, false)}</div>
          <div class="peek"><b>Overview</b><span></span><span></span></div>
        </section>

        <section class="view view--m">
          <small class="tag">MOBILE · 390</small>
          <div class="phone">
            <div class="stack">${mobileBar} ${subRow(rule, true)}</div>
            <div class="peek"><b>Overview</b><span></span><span></span></div>
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
        border-radius: 22px;
        background: #0a0d10;
        overflow: hidden;
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
      .ident,
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

      .sub--pinned {
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 0;
      }

      .sub__line {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 48px;
        padding: 0 14px;
      }

      .phone .sub__line {
        gap: 8px;
        min-height: 44px;
        padding: 0 8px;
      }

      .sub__line--strip {
        min-height: 44px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
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

      .ident__text,
      .live__text,
      .current {
        display: grid;
        text-align: left;
      }

      .ident__text small,
      .live__text small,
      .current small {
        color: var(--muted);
        font-size: 9px;
        letter-spacing: 0.16em;
      }

      .ident__text b,
      .live__text b,
      .current b {
        font-weight: 500;
        font-size: 14px;
        line-height: 1.2;
        white-space: nowrap;
      }

      .rule {
        width: 1px;
        height: 24px;
        background: var(--line);
      }

      .current {
        padding-inline: 2px;
      }

      .live {
        padding: 5px 10px;
        border: 1px solid rgba(0, 252, 6, 0.3);
        border-radius: 10px;
        background: rgba(0, 252, 6, 0.08);
      }

      .live__dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 4px rgba(0, 252, 6, 0.16);
      }

      .live__text small {
        color: var(--accent);
      }

      .live em {
        font-style: normal;
        color: var(--muted);
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

      .strip {
        position: relative;
        flex: 1;
        overflow: hidden;
      }

      .strip__track {
        display: flex;
        gap: 4px;
      }

      .strip__track a {
        padding: 7px 12px;
        border-radius: 8px;
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .strip__track a.is-current {
        box-shadow: inset 0 -2px 0 var(--accent);
        color: var(--ink);
      }

      .strip__fade {
        position: absolute;
        inset: 0 0 0 auto;
        width: 48px;
        background: linear-gradient(90deg, rgba(25, 34, 45, 0), var(--card));
      }

      .strip__next {
        position: absolute;
        inset: 50% 0 auto auto;
        display: grid;
        place-items: center;
        width: 26px;
        height: 26px;
        transform: translateY(-50%);
        border-radius: 50%;
        background: #1f2937;
        color: var(--ink);
        font-size: 16px;
      }

      .peek {
        display: grid;
        gap: 10px;
        margin: 14px 0 0;
        padding: 18px;
        border-radius: 14px;
        background: radial-gradient(120% 130% at 50% 0%, #0f2a18, #12171e 70%);
      }

      .phone .peek {
        margin: 0 8px 8px;
      }

      .peek b {
        font-weight: 500;
        font-size: 20px;
      }

      .peek span {
        height: 10px;
        border-radius: 5px;
        background: rgba(255, 255, 255, 0.06);
      }

      .peek span:last-child {
        width: 60%;
      }
    `,
  });
