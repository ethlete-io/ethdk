import { css, drawing, html } from '@design-explore';
import { COMPETITION, CURRENT, LIVE, PAGES, STAGES } from './fixture';

/** What the controls in the competition row open. */
export type OpenRule = 'mega' | 'anchored' | 'spotlight';

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

const liveChip = (short: boolean, open: boolean) => html`
  <button class="live ${open ? 'is-open' : ''}" type="button">
    <span class="live__dot"></span>
    <span class="live__text">
      <small>LIVE NOW</small>
      <b>${short ? 'Continental' : LIVE.name}</b>
    </span>
    <em>${open ? '⌃' : '⌄'}</em>
  </button>
`;

const mapControl = (label: string, open: boolean) => html`
  <button class="map ${open ? 'is-open' : ''}" type="button">
    <span class="map__grid"><i></i><i></i><i></i><i></i></span>
    ${label && html`<span>${label}</span>`}
    <i class="map__count">${PAGES.length + STAGES.length}</i>
  </button>
`;

const currentChip = html`<span class="current"><small>YOU ARE ON</small><b>${CURRENT}</b></span>`;

const railRows = html`
  <ul class="rail">
    ${STAGES.map(
      (stage) => html`
        <li class="rail__row" data-status="${stage.status}">
          <span class="rail__mark">${stage.status === 'completed' ? '✓' : ''}</span>
          <span class="rail__text">
            <b>${stage.name}</b>
            <small>${stage.status === 'running' ? 'Live now · ' : ''}${stage.detail}</small>
          </span>
          <em>›</em>
        </li>
      `,
    )}
  </ul>
`;

const pageRows = html`
  <ul class="pages">
    ${PAGES.map((page) => html`<li class="${page === CURRENT ? 'is-current' : ''}">${page}</li>`)}
  </ul>
`;

const spotlight = html`
  <article class="spot">
    <span class="spot__art"></span>
    <small><span class="live__dot"></span>LIVE NOW</small>
    <b>${LIVE.name}</b>
    <span class="spot__detail">${LIVE.detail}</span>
    <span class="spot__cta">Go to the finals bracket ›</span>
  </article>
`;

const columnTitle = (text: string) => html`<h3 class="col-title">${text}</h3>`;

const desktopPanel = (rule: OpenRule) => {
  if (rule === 'anchored') {
    return html` <div class="panel panel--anchored">${columnTitle('Stages')} ${railRows}</div> `;
  }

  if (rule === 'spotlight') {
    return html`
      <div class="panel panel--spotlight">
        <div class="panel__lead">${spotlight}</div>
        <div class="panel__col">${columnTitle('Stages')} ${railRows}</div>
        <div class="panel__col panel__col--narrow">${columnTitle('About this competition')} ${pageRows}</div>
      </div>
    `;
  }

  return html`
    <div class="panel panel--mega">
      <div class="panel__col panel__col--narrow">${columnTitle('About this competition')} ${pageRows}</div>
      <div class="panel__col">${columnTitle('Stages')} ${railRows}</div>
      <div class="panel__col panel__col--spot">${columnTitle('Happening now')} ${spotlight}</div>
    </div>
  `;
};

const sheetHead = (title: string) => html`
  <header class="sheet__head">
    <span class="mark">${COMPETITION.mark}</span>
    <span class="ident__text"><small>${title}</small><b>${COMPETITION.short}</b></span>
    <span class="grow"></span>
    <button class="icon" type="button" aria-label="Close">✕</button>
  </header>
`;

const mobileSheet = (rule: OpenRule) => {
  if (rule === 'anchored') {
    return html` <div class="sheet">${sheetHead('STAGES')} ${railRows}</div> `;
  }

  if (rule === 'spotlight') {
    return html`
      <div class="sheet">
        ${sheetHead('COMPETITION')} ${spotlight} ${columnTitle('Stages')} ${railRows}
        ${columnTitle('About this competition')} ${pageRows}
      </div>
    `;
  }

  return html`
    <div class="sheet">
      ${sheetHead('COMPETITION')} ${columnTitle('Stages')} ${railRows} ${columnTitle('About this competition')}
      ${pageRows}
    </div>
  `;
};

/**
 * The live-led row call 10 chose, with its map open. Only `rule` changes: what opens, and from
 * which control.
 */
export const openMap = ({ rule }: { rule: OpenRule }) =>
  drawing({
    body: html`
      <div class="page" data-rule="${rule}">
        <section class="view">
          <small class="tag">DESKTOP · 1400 · OPEN</small>
          <div class="stack">
            ${desktopBar}
            <nav class="sub">
              ${ident(false)} ${liveChip(false, rule === 'anchored')}
              <span class="grow"></span>
              ${currentChip} ${mapControl('Competition', rule !== 'anchored')}
            </nav>
            ${desktopPanel(rule)}
          </div>
          <div class="peek"><b>Overview</b><span></span><span></span></div>
        </section>

        <section class="view">
          <small class="tag">MOBILE · 390 · OPEN</small>
          <div class="phone">
            <div class="stack">
              ${mobileBar}
              <nav class="sub">
                ${ident(true)} ${liveChip(true, rule === 'anchored')}
                <span class="grow"></span>
                ${mapControl('', rule !== 'anchored')}
              </nav>
            </div>
            ${mobileSheet(rule)}
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
        position: relative;
        width: 390px;
        padding-bottom: 12px;
        border-radius: 22px;
        background: #0a0d10;
      }

      .stack {
        position: relative;
        border-radius: 20px;
        background: var(--card);
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

      .ident {
        gap: 10px;
        padding: 4px 8px 4px 4px;
        border-radius: 10px;
      }

      .mark {
        display: grid;
        place-items: center;
        flex: none;
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

      .current {
        padding-inline: 2px;
      }

      .live {
        padding: 5px 10px;
        border: 1px solid rgba(0, 252, 6, 0.3);
        border-radius: 10px;
        background: rgba(0, 252, 6, 0.08);
      }

      .live.is-open {
        border-color: var(--accent);
        background: rgba(0, 252, 6, 0.16);
      }

      .live__dot {
        flex: none;
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

      .map.is-open {
        background: #2b3646;
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

      .col-title {
        margin: 0 0 10px;
        color: var(--muted);
        font-weight: 400;
        font-size: 11px;
        letter-spacing: 0.16em;
      }

      .panel {
        border-top: 1px solid var(--line);
        padding: 20px 24px 24px;
      }

      .panel--mega,
      .panel--spotlight {
        display: grid;
        gap: 28px;
      }

      .panel--mega {
        grid-template-columns: 260px 1fr 380px;
      }

      .panel--spotlight {
        grid-template-columns: 380px 1fr 260px;
      }

      .panel--anchored {
        position: absolute;
        inset: 100% auto auto 230px;
        width: 380px;
        margin-top: 8px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--card);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
      }

      .rail {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .rail__row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 6px 12px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        cursor: pointer;
      }

      .rail__row:last-child {
        border-bottom: 0;
      }

      .rail__row::before {
        content: '';
        position: absolute;
        inset: 0 auto -1px 13px;
        width: 2px;
        background: #2f6d3a;
      }

      .rail__row:first-child::before {
        inset-block-start: 50%;
      }

      .rail__row:last-child::before {
        inset-block-end: 50%;
      }

      .rail__mark {
        position: relative;
        display: grid;
        place-items: center;
        flex: none;
        width: 28px;
        height: 28px;
        border: 2px solid #2f6d3a;
        border-radius: 50%;
        background: var(--card);
        color: var(--accent);
        font-size: 13px;
      }

      .rail__row[data-status='running'] .rail__mark {
        border-color: var(--accent);
        background: var(--accent);
        box-shadow: 0 0 0 4px rgba(0, 252, 6, 0.16);
      }

      .rail__row[data-status='upcoming'] .rail__mark {
        border-color: #3a4454;
      }

      .rail__text {
        display: grid;
        gap: 2px;
      }

      .rail__text b {
        font-weight: 500;
        font-size: 15px;
      }

      .rail__text small {
        color: var(--muted);
        font-size: 12px;
      }

      .rail__row[data-status='running'] .rail__text small {
        color: var(--accent);
      }

      .rail__row[data-status='upcoming'] .rail__text b {
        color: var(--muted);
      }

      .rail em {
        margin-left: auto;
        color: var(--muted);
        font-style: normal;
        font-size: 18px;
      }

      .pages {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .pages li {
        padding: 10px 0;
        font-size: 15px;
        cursor: pointer;
      }

      .pages li.is-current {
        box-shadow: inset 2px 0 0 var(--accent);
        padding-left: 10px;
      }

      .spot {
        position: relative;
        display: grid;
        gap: 4px;
        align-content: end;
        min-height: 180px;
        padding: 16px;
        border: 1px solid rgba(0, 252, 6, 0.24);
        border-radius: 14px;
        background: radial-gradient(120% 140% at 30% 0%, rgba(0, 252, 6, 0.16), #141c26 70%);
        overflow: hidden;
      }

      .spot__art {
        position: absolute;
        inset: -20% -10% auto auto;
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 252, 6, 0.22), transparent 65%);
      }

      .spot small {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--accent);
        font-size: 10px;
        letter-spacing: 0.16em;
      }

      .spot b {
        font-weight: 500;
        font-size: 20px;
      }

      .spot__detail {
        color: var(--muted);
        font-size: 13px;
      }

      .spot__cta {
        margin-top: 8px;
        font-size: 13px;
        color: var(--accent);
      }

      .sheet {
        position: relative;
        margin: 0 8px;
        padding: 0 14px 16px;
        border-radius: 16px;
        background: var(--card);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
      }

      .sheet__head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 0;
        border-bottom: 1px solid var(--line);
        margin-bottom: 14px;
      }

      .sheet .col-title {
        margin-top: 16px;
      }

      .sheet .spot {
        min-height: 150px;
      }

      .peek {
        display: grid;
        gap: 10px;
        margin: 14px 0 0;
        padding: 18px;
        border-radius: 14px;
        background: radial-gradient(120% 130% at 50% 0%, #0f2a18, #12171e 70%);
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
