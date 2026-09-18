import { css, drawing, html } from '@design-explore';
import { CURRENT, LIVE, PAGES } from './fixture';

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

/** Where the chevron that opens all stages sits against the live stage control. */
export type ChevronRule = 'full-seam' | 'inset-seam' | 'own-square';

const chevron = html`<button class="ctl__more" type="button" aria-label="All stages"><em>⌄</em></button>`;

const liveSplit = (rule: ChevronRule, long: boolean) => {
  const main = html`
    <a class="ctl__main">
      <span class="dot"></span>
      <span class="ctl__text">
        <b>${long ? LIVE.long : LIVE.name}</b>
        ${!long && html`<small>${LIVE.detail}</small>`}
      </span>
    </a>
  `;

  if (rule === 'own-square') {
    return html`
      <span class="pair">
        <span class="ctl ctl--live">${main}</span>
        <span class="ctl ctl--live ctl--square">${chevron}</span>
      </span>
    `;
  }

  return html`
    <span class="ctl ctl--live ctl--split" data-seam="${rule}">
      ${main}
      <span class="ctl__seam"></span>
      ${chevron}
    </span>
  `;
};

const links = html`
  <div class="links">${PAGES.map((page) => html`<a class="${page === CURRENT ? 'is-current' : ''}">${page}</a>`)}</div>
`;

/**
 * The call 16 A row with the competition name removed. At 1400px every page fits, so there is no
 * overflow menu, and no control carries a count.
 */
export const desktopRow = ({ rule }: { rule: ChevronRule }) =>
  drawing({
    body: html`
      <div class="page">
        <div class="stack">
          ${desktopBar}
          <nav class="sub">
            ${links}
            <span class="grow"></span>
            ${liveSplit(rule, false)}
          </nav>
        </div>
        <span class="caption">A stage name the control cannot fit · no subline</span>
        <div class="stack">
          <nav class="sub">
            ${links}
            <span class="grow"></span>
            ${liveSplit(rule, true)}
          </nav>
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
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 0 18px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .name {
        max-width: 260px;
        overflow: hidden;
        font-weight: 500;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      [data-rule='short'] .name {
        max-width: none;
      }

      .name-entry {
        max-width: 260px;
        overflow: hidden;
        color: var(--ink) !important;
        font-weight: 500;
        text-overflow: ellipsis;
      }

      .rule {
        width: 1px;
        height: 22px;
        background: var(--line);
      }

      .links {
        display: flex;
        gap: 4px;
      }

      .links a {
        padding: 9px 14px;
        border-radius: 10px;
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .links a.is-current {
        background: rgb(var(--primary) / 0.14);
        color: var(--ink);
      }

      .ctl {
        height: 40px;
        padding-inline: 12px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .links .ctl--quiet {
        height: auto;
        padding: 9px 14px;
        border-color: transparent;
        background: none;
        color: var(--muted);
      }

      .ctl--live {
        border-color: rgb(var(--primary) / 0.28);
        background: rgb(var(--primary) / 0.1);
      }

      .ctl--split {
        gap: 0;
        padding-inline: 0;
      }

      .ctl__main {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 100%;
        padding-inline: 12px;
      }

      .ctl__seam {
        width: 1px;
        height: 100%;
        background: rgb(var(--primary) / 0.28);
      }

      [data-seam='inset-seam'] .ctl__seam {
        align-self: center;
        height: 22px;
      }

      .ctl__text {
        display: grid;
        text-align: left;
      }

      .ctl__text b {
        overflow: hidden;
        color: rgb(var(--primary));
        font-weight: 500;
        font-size: 14px;
        line-height: 1.15;
        text-overflow: ellipsis;
      }

      .ctl__text small {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.15;
      }

      .pair {
        display: flex;
        gap: 8px;
      }

      .ctl--square {
        display: grid;
        place-items: center;
        width: 40px;
        padding-inline: 0;
      }

      .caption {
        display: block;
        margin: 18px 2px 8px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .ctl__more {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 100%;
        padding-inline: 10px;
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgb(var(--primary));
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
