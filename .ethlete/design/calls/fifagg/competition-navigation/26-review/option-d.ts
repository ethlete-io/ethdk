import { css, drawing, html } from '@design-explore';
import { CURRENT, LIVE, PAGES } from './desktop-fixture';
import { phoneRow } from './phone';

const phone = phoneRow();

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

const bar = html`
  <header class="bar">
    <span class="logo">FIFA<i>e</i></span>
    <button class="zone" type="button">${padIcon}<span>GAMING</span></button>
    <button class="zone zone--on" type="button">${laurelIcon}<span>ESPORTS</span></button>
    <span class="grow"></span>
    <button class="search" type="button">${searchIcon}<span>Search</span><kbd>ctrl</kbd><kbd>↵</kbd></button>
    <button class="login" type="button"><span>Login</span></button>
  </header>
`;

const unit = (long: boolean) => html`
  <span class="unit">
    <a class="unit__home">${CURRENT}</a>
    <span class="unit__seam"></span>
    <a class="unit__stage">
      <span class="dot"></span>
      <span class="unit__text">
        <b>${long ? LIVE.long : LIVE.name}</b>
        <small>${LIVE.detail}</small>
      </span>
    </a>
    <span class="unit__seam"></span>
    <button class="unit__more" type="button" aria-label="All stages"><em>⌄</em></button>
  </span>
`;

const row = ({ narrow = false, long = false }: { narrow?: boolean; long?: boolean }) => html`
  <nav class="sub">
    ${unit(long)}
    <div class="links">
      ${(narrow ? PAGES.slice(1, 4) : PAGES.slice(1)).map((page) => html`<a>${page}</a>`)}
      ${narrow && html`<button class="quiet" type="button"><span>More</span><em>⌄</em></button>`}
    </div>
    <span class="grow"></span>
  </nav>
`;

const desktop = html`
  <div class="page">
    <div class="stack">${bar}${row({})}</div>
    <span class="caption">A viewport too narrow for every page · the strip overflows</span>
    <div class="stack stack--narrow">${row({ narrow: true })}</div>
    <span class="caption">A stage name the control cannot fit</span>
    <div class="stack">${row({ long: true })}</div>
  </div>
`;

/** Overview and the stage as one segmented unit at the head of the row, the pages after it. */
export default drawing({
  body: html`
    <div class="pane pane--desktop">${desktop}</div>
    <div class="pane pane--phone">${phone.body}</div>
  `,
  styles: css`
    :root {
      color-scheme: dark;
    }

    body {
      margin: 0;
      background: #12171e;
    }

    .pane--phone {
      border-top: 1px dashed #283140;

      ${phone.styles}
    }

    .pane--desktop {
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

      .stack--narrow {
        width: 1024px;
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
      .quiet {
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

      .zone:hover {
        background: #1f2937;
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

      .login:hover {
        background: #3a8df7;
      }

      .sub {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 0 18px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(70% 738.03% at 12% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .links {
        display: flex;
        gap: 4px;
      }

      .links a,
      .quiet {
        padding: 9px 14px;
        border-radius: 10px;
        color: var(--muted);
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .links a:hover,
      .quiet:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ink);
      }

      .unit {
        display: flex;
        flex: none;
        align-items: stretch;
        height: 40px;
        border: 1px solid rgb(var(--primary) / 0.28);
        border-radius: 10px;
        background: #1f2937;
        font-size: 14px;
        white-space: nowrap;
        cursor: pointer;
      }

      .unit__home {
        display: flex;
        align-items: center;
        padding-inline: 14px;
        border-radius: 9px 0 0 9px;
        color: var(--ink);
      }

      .unit__home:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      .unit__seam {
        width: 1px;
        background: rgb(var(--primary) / 0.28);
      }

      .unit__stage {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-inline: 12px;
        background: rgb(var(--primary) / 0.1);
      }

      .unit__stage:hover {
        background: rgb(var(--primary) / 0.16);
      }

      .unit__text {
        display: grid;
        text-align: left;
      }

      .unit__text b {
        max-width: 280px;
        overflow: hidden;
        color: rgb(var(--primary));
        font-weight: 500;
        line-height: 1.15;
        text-overflow: ellipsis;
      }

      .unit__text small {
        color: var(--muted);
        font-size: 11px;
        line-height: 1.15;
      }

      .unit__more {
        display: flex;
        align-items: center;
        padding-inline: 10px;
        border-radius: 0 9px 9px 0;
        background: rgb(var(--primary) / 0.1);
      }

      .unit__more:hover {
        background: rgb(var(--primary) / 0.16);
      }

      .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgb(var(--primary));
        box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
      }

      em {
        color: var(--muted);
        font-style: normal;
      }

      .caption {
        display: block;
        margin: 18px 2px 8px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      :focus-visible {
        outline: 2px solid rgb(var(--primary) / 0.7);
        outline-offset: 2px;
      }
    }
  `,
});
