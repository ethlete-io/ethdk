import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS, Turn } from './fixture';

const CHIPS = ['B · A hairline frame and the change', CALL.option, 'E · The change goes quiet'];

const RAILS = [
  { eyebrow: 'Sandbox · call 0', headline: CALL.headline, on: true },
  { eyebrow: 'Sandbox · call 1', headline: 'How a day names the work it holds', on: false },
  { eyebrow: 'Sandbox · call 2', headline: 'What a running entry looks like', on: false },
];

const FILLED = (SESSION.tokens / SESSION.limit) * 100;

const turn = (item: Turn) => {
  if (item.kind === 'ask') return html`<p class="ask">${item.text}</p>`;
  if (item.kind === 'say') return html`<p class="say">${item.text}</p>`;

  return html`
    <p class="act">
      <span class="act-action">${item.action}</span>
      <span class="act-detail">${item.detail}</span>
    </p>
  `;
};

export default drawing({
  body: html`
    <div class="window">
      <div class="rail">
        <div class="search"></div>
        ${RAILS.map(
          (row) => html`
            <div class="call ${row.on && 'on'}">
              <span class="call-eyebrow">${row.eyebrow}</span>
              <span class="call-headline">${row.headline}</span>
              <span class="call-state">0 of 6 settled</span>
            </div>
          `,
        )}
      </div>

      <div class="stage">
        <div class="chips">
          ${CHIPS.map((chip) => html`<span class="chip ${chip === CALL.option && 'on'}">${chip}</span>`)}
        </div>
        <div class="plate">
          <span class="plate-label">the drawn option</span>
        </div>
      </div>

      <div class="chat">
        <div class="thread">
          ${TURNS.map(turn)}
          <p class="act live">
            <span class="act-action">${LIVE.action}</span>
            <span class="act-detail">${LIVE.detail}</span>
          </p>
        </div>

        <div class="foot">
          <div class="prompt">${DRAFT}</div>
          <div class="bar">
            <span class="cli">${CLI}</span>
            <span class="meter">
              <span class="meter-id">${SESSION.id}</span>
              <span class="meter-track"><span class="meter-fill" style="width: ${FILLED}%"></span></span>
              <span class="meter-value">152k</span>
            </span>
            <span class="send">Send</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: css`
    #root {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    .rail {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 0 0 20rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    .search {
      height: 2.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    .call {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    .call.on {
      background: ${PLATE};
    }

    .call-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    .call-state {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .stage {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    .chips {
      display: flex;
      gap: 0.8rem;
    }

    .chip {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .chip.on {
      border-color: ${INK};
      color: ${INK};
    }

    .plate {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 auto;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    .plate-label {
      font-size: 1.2rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .chat {
      display: flex;
      flex-direction: column;
      flex: 0 0 34rem;
      min-height: 0;
      border-left: 1px solid ${LINE};
    }

    .thread {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      flex: 1 1 auto;
      min-height: 0;
      padding: 1.6rem;
      overflow: hidden;
    }

    .ask {
      margin: 0 0 0 1.2rem;
      padding-left: 1.2rem;
      border-left: 2px solid ${LINE};
      font-size: 1.3rem;
      line-height: 1.55;
      color: ${INK};
    }

    .say {
      margin: 0;
      font-size: 1.3rem;
      line-height: 1.6;
      color: ${INK};
    }

    .act {
      display: flex;
      gap: 0.8rem;
      margin: 0;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      line-height: 1.4;
      white-space: nowrap;
    }

    .act-action {
      color: ${INK};
    }

    .act-detail {
      overflow: hidden;
      text-overflow: ellipsis;
      color: ${MUTED};
    }

    .live .act-action {
      color: ${ACCENT};
    }

    .live .act-action::after {
      content: ' ·';
      color: ${ACCENT};
    }

    .foot {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      padding: 1.6rem;
      border-top: 1px solid ${LINE};
    }

    .prompt {
      min-height: 7.2rem;
      padding: 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
      font-size: 1.3rem;
      line-height: 1.5;
    }

    .bar {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .cli {
      white-space: nowrap;
    }

    .meter {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }

    .meter-track {
      flex: 1 1 auto;
      height: 0.3rem;
      border-radius: 999px;
      background: ${LINE};
    }

    .meter-fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: ${MUTED};
    }

    .send {
      padding: 0.5rem 1.4rem;
      border-radius: 0.4rem;
      background: ${ACCENT};
      color: ${GROUND};
      font-family: 'Jost', sans-serif;
      font-size: 1.2rem;
    }
  `,
});
