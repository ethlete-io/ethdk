import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS, Turn } from './fixture';

const STATES = [
  { label: 'Closed', open: false },
  { label: 'Open', open: true },
];

const FILL = (SESSION.tokens / SESSION.limit) * 100;
const USED = `${Math.round(SESSION.tokens / 1000)}k`;

const turn = (item: Turn) => {
  if (item.kind === 'ask') return html`<p class="ask">${item.text}</p>`;
  if (item.kind === 'say') return html`<p class="say">${item.text}</p>`;

  return html`
    <p class="act">
      <span class="act-name">${item.action}</span>
      <span class="act-detail">${item.detail}</span>
    </p>
  `;
};

const drawer = () => html`
  <div class="drawer">
    <div class="drawer-head">
      <span>the conversation</span>
      <span>close</span>
    </div>

    <div class="turns">
      ${TURNS.map(turn)}

      <p class="act is-live">
        <span class="act-name">${LIVE.action}</span>
        <span class="act-detail">${LIVE.detail}</span>
      </p>
    </div>
  </div>
`;

const state = (drawn: (typeof STATES)[number]) => html`
  <p class="state-label">${drawn.label}</p>

  <div class="win">
    <div class="rail">
      <div class="search"></div>

      <div class="call-row">
        <span class="bar bar-eyebrow"></span>
        <span class="bar bar-headline"></span>
        <span class="bar bar-settled"></span>
      </div>

      <div class="call-row is-current">
        <span class="eyebrow">${CALL.project} · call 0</span>
        <span class="call-headline">${CALL.headline}</span>
        <span class="settled">0 of 6 settled</span>
      </div>

      <div class="call-row">
        <span class="bar bar-eyebrow"></span>
        <span class="bar bar-headline"></span>
        <span class="bar bar-settled"></span>
      </div>
    </div>

    <div class="main">
      <div class="chips">
        <span class="chip is-current">${CALL.option}</span>
        <span class="chip"><span class="bar bar-chip"></span></span>
        <span class="chip"><span class="bar bar-chip"></span></span>
      </div>

      <div class="canvas ${drawn.open && 'is-open'}">
        <div class="drawing">
          <span class="drawing-label">the drawn component</span>
        </div>

        ${drawn.open && drawer()}
      </div>

      <div class="prompt">${DRAFT}</div>

      <div class="status">
        <span class="live">
          <span class="act-name">${LIVE.action}</span>
          <span class="act-detail">${LIVE.detail}</span>
        </span>
        <span class="turns-control">${TURNS.length} turns</span>
        <span class="cli">${CLI}</span>
        <span class="meter">
          <span class="session">${SESSION.id}</span>
          <span class="meter-bar"><span class="meter-fill" style="width: ${FILL}%"></span></span>
          <span class="used">${USED}</span>
        </span>
        <span class="send">Send</span>
      </div>
    </div>
  </div>
`;

export default drawing({
  body: html`${STATES.map(state)}`,
  styles: css`
    #root {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    .state-label {
      margin: 0;
      padding: 1.6rem 1.6rem 0.8rem;
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .win {
      display: flex;
      height: 72rem;
      border-top: 1px solid ${LINE};
      border-bottom: 1px solid ${LINE};
      background: ${GROUND};
      overflow: hidden;
    }

    .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 20rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    .search {
      height: 3.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    .call-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.6rem;
    }

    .call-row.is-current {
      background: ${PLATE};
    }

    .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
      color: ${INK};
    }

    .settled {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.4rem;
      background: ${LINE};
    }

    .bar-eyebrow {
      width: 45%;
      height: 0.6rem;
    }

    .bar-headline {
      width: 85%;
      height: 1rem;
    }

    .bar-settled {
      width: 55%;
      height: 0.6rem;
    }

    .main {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1;
      min-width: 0;
      padding: 1.6rem;
    }

    .chips {
      display: flex;
      gap: 0.8rem;
    }

    .chip {
      display: flex;
      align-items: center;
      min-width: 9rem;
      padding: 0.6rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .chip.is-current {
      min-width: 0;
      background: ${PLATE};
      border-color: ${MUTED};
      color: ${INK};
    }

    .bar-chip {
      width: 100%;
      height: 0.6rem;
    }

    .canvas {
      position: relative;
      flex: 1;
      min-height: 0;
    }

    .drawing {
      display: grid;
      place-items: center;
      height: 100%;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
    }

    .canvas.is-open .drawing {
      opacity: 0.35;
    }

    .drawing-label {
      font-size: 1.1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .drawer {
      position: absolute;
      inset: 2.4rem;
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      padding: 2rem 2.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: color-mix(in srgb, ${PLATE} 88%, #ffffff);
      box-shadow: 0 1.6rem 4rem rgb(0 0 0 / 45%);
      overflow: hidden;
    }

    .drawer-head {
      display: flex;
      justify-content: space-between;
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .turns {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      min-height: 0;
    }

    .turns p {
      margin: 0;
    }

    .ask {
      padding-left: 1.4rem;
      border-left: 2px solid ${ACCENT};
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    .say {
      max-width: 64rem;
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    .act {
      display: flex;
      gap: 1rem;
      font-family: 'Jetbrains Mono', ui-monospace, monospace;
      font-size: 1.2rem;
      color: ${INK};
    }

    .act-detail {
      color: ${MUTED};
    }

    .act.is-live,
    .act.is-live .act-detail {
      color: ${ACCENT};
    }

    .act.is-live .act-detail {
      opacity: 0.7;
    }

    .prompt {
      padding: 1.4rem 1.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    .status {
      display: flex;
      align-items: center;
      gap: 1.6rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .live {
      display: flex;
      gap: 1rem;
      flex: 1;
      min-width: 0;
      font-family: 'Jetbrains Mono', ui-monospace, monospace;
      color: ${ACCENT};
    }

    .live .act-detail {
      color: ${ACCENT};
      opacity: 0.7;
    }

    .turns-control {
      padding: 0.4rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      color: ${MUTED};
    }

    .meter {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      font-variant-numeric: tabular-nums;
    }

    .meter-bar {
      display: block;
      width: 8rem;
      height: 0.4rem;
      border-radius: 999px;
      background: ${LINE};
      overflow: hidden;
    }

    .meter-fill {
      display: block;
      height: 100%;
      background: ${MUTED};
    }

    .send {
      padding: 0.5rem 1.4rem;
      border: 1px solid ${MUTED};
      border-radius: 0.6rem;
      color: ${INK};
    }
  `,
});
