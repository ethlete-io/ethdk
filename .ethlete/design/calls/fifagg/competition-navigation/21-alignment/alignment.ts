import { css, drawing, html } from '@design-explore';
import { COMPETITION, LIVE } from './fixture';

/** What the chip and the square line up with in the header row above them. */
export type AlignRule = 'boxes' | 'ink' | 'own-gutter';

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

const grid = html`<span class="grid"><i></i><i></i><i></i><i></i></span>`;

/**
 * The phone row at 390px, drawn over two guides: the left edge of the wordmark, and the right edge
 * of the burger glyph. Every option changes only what the second row lines up with.
 */
export const alignment = ({ rule }: { rule: AlignRule }) =>
  drawing({
    body: html`
      <div class="page">
        <div class="stack" data-rule="${rule}">
          <span class="guide guide--left"></span>
          <span class="guide guide--right"></span>
          <header class="bar">
            <span class="logo">FIFA<i>e</i></span>
            <span class="grow"></span>
            <button class="icon" type="button" aria-label="Search">${searchIcon}</button>
            <button class="icon" type="button" aria-label="Menu">${burgerIcon}</button>
          </header>
          <nav class="sub">
            <button class="chip" type="button">
              <span class="dot"></span>
              <b>${LIVE.name}</b>
              <span class="chip__detail">is live now</span>
            </button>
            <span class="grow"></span>
            <button class="square" type="button" aria-label="All of the competition">${grid}</button>
          </nav>
        </div>
        <div class="banner">
          <span class="banner__art">Cyprus Football Association Esports Competition<br />Featuring Rocket League™</span>
          <b>${COMPETITION.name}</b>
        </div>
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
        position: relative;
        border-radius: 20px;
        background: var(--card);
        overflow: hidden;
      }

      .guide {
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 2;
        width: 0;
        border-left: 1px dashed rgba(255, 255, 255, 0.28);
        pointer-events: none;
      }

      .guide--left {
        left: 16px;
      }

      .guide--right {
        right: 25px;
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
        gap: 8px;
        width: 100%;
        min-height: 48px;
        padding-block: 8px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      [data-rule='boxes'] .sub {
        padding-inline: 16px;
      }

      [data-rule='ink'] .sub {
        padding-left: 3px;
        padding-right: 10.5px;
      }

      [data-rule='own-gutter'] .sub {
        padding-inline: 24px;
      }

      .chip {
        display: flex;
        align-items: center;
        gap: 7px;
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

      .square {
        display: grid;
        flex: none;
        place-items: center;
        width: 44px;
        height: 40px;
        border-radius: 10px;
        background: #1f2937;
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

      .body {
        display: grid;
        gap: 10px;
        margin-top: 18px;
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
