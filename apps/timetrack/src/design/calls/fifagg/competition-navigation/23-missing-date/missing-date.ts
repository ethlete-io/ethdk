import { css, drawing, html } from '@design-explore';
import { COMPETITION, STAGES } from './fixture';

/** What the chip reads when the stage has no date the row can show. */
export type DateRule = 'verb-only' | 'name-only' | 'name-the-gap';

/** `sound` is the only state with a date worth printing. The rest are what the data really does. */
export type DateState = 'sound' | 'missing' | 'unusable' | 'ended';

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

const detailFor = (rule: DateRule, state: DateState) => {
  if (state === 'sound') return STAGES.sound;

  if (rule === 'name-only') return '';

  if (rule === 'verb-only') return state === 'ended' ? 'ended' : 'next';

  return state === 'ended' ? 'ended' : 'date to come';
};

const row = (rule: DateRule, state: DateState) => {
  const name = state === 'ended' ? STAGES.last : STAGES.next;
  const detail = detailFor(rule, state);

  return html`
    <nav class="sub">
      <button class="chip" type="button">
        ${state === 'ended' ? html`<span class="spacer"></span>` : html`<span class="dot"></span>`}
        <b>${name}</b>
        ${detail && html`<span class="chip__detail">${detail}</span>`}
      </button>
      <span class="grow"></span>
      <button class="square" type="button" aria-label="All of the competition">${grid}</button>
    </nav>
  `;
};

const STRIPS: { state: DateState; caption: string }[] = [
  { state: 'sound', caption: 'A date the row can show · the reference' },
  { state: 'unusable', caption: 'scheduledAt holds a value the row cannot show' },
  { state: 'ended', caption: 'The last stage ended, and carries no date' },
];

/**
 * The phone row at 390px with `scheduledAt` missing, and the same rule drawn below for a sound
 * date, a value the row cannot show, and a stage that ended.
 */
export const missingDate = ({ rule }: { rule: DateRule }) =>
  drawing({
    body: html`
      <div class="page">
        <div class="stack">
          <header class="bar">
            <span class="logo">FIFA<i>e</i></span>
            <span class="grow"></span>
            <button class="icon" type="button" aria-label="Search">${searchIcon}</button>
            <button class="icon" type="button" aria-label="Menu">${burgerIcon}</button>
          </header>
          ${row(rule, 'missing')}
        </div>
        <span class="caption caption--lead">scheduledAt is null</span>
        <div class="banner">
          <span class="banner__art">Cyprus Football Association Esports Competition<br />Featuring Rocket League™</span>
          <b>${COMPETITION.name}</b>
        </div>
        <div class="states">
          ${STRIPS.map(
            (strip) => html`
              <span class="caption">${strip.caption}</span>
              <div class="stack stack--strip">${row(rule, strip.state)}</div>
            `,
          )}
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

      .stack--strip {
        border-radius: 14px;
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
        padding-inline: 16px;
        border-top: 1px solid var(--line);
        background:
          radial-gradient(100% 738.03% at 100% 0%, rgb(var(--primary) / 0.15) 0%, rgb(var(--primary) / 0) 100%),
          var(--card);
      }

      .stack--strip .sub {
        border-top: 0;
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
        border: 2px solid rgb(var(--primary) / 0.7);
        border-radius: 50%;
      }

      .spacer {
        display: none;
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

      .caption {
        display: block;
        margin: 10px 2px 6px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .caption--lead {
        color: rgb(var(--primary) / 0.75);
      }

      .banner {
        display: grid;
        grid-template-rows: 1fr auto;
        gap: 6px;
        height: 180px;
        padding: 16px;
        border-radius: 16px;
        background: radial-gradient(120% 120% at 50% 20%, #12305c, #0c1524 70%);
      }

      .banner__art {
        align-self: start;
        margin-top: 24px;
        padding-inline: 24px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 11px;
        text-align: center;
      }

      .banner b {
        font-weight: 600;
        font-size: 22px;
        line-height: 1.15;
      }

      .states {
        margin-top: 14px;
        border-top: 1px dashed var(--line);
      }
    `,
  });
