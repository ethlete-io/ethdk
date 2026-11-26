import { css, drawing, html } from '@design-explore';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS, Turn } from './fixture';

const GHOSTS = [1, 2];
const FILL = (SESSION.tokens / SESSION.limit) * 100;
const USED = `${Math.round(SESSION.tokens / 1000)}k`;

const turn = (item: Turn) => {
  if (item.kind === 'ask') return html`<p class="ask">${item.text}</p>`;
  if (item.kind === 'say') return html`<p class="say">${item.text}</p>`;

  return html`
    <p class="act">
      <span class="action">${item.action}</span>
      <span class="detail">${item.detail}</span>
    </p>
  `;
};

export default drawing({
  body: html`
    <div class="window">
      <div class="rail">
        <div class="search">Search</div>
        <div class="calls">
          <div class="call open">
            <span class="eyebrow">${CALL.project}</span>
            <span class="headline">${CALL.headline}</span>
            <span class="settled">0 of 6 settled</span>
          </div>
          ${GHOSTS.map(
            () => html`
              <div class="call">
                <span class="bar eyebrow-bar"></span>
                <span class="bar headline-bar"></span>
                <span class="settled">0 of 6 settled</span>
              </div>
            `,
          )}
        </div>
      </div>

      <div class="main">
        <div class="stage">
          <div class="chips">
            <span class="chip open">${CALL.option}</span>
            ${GHOSTS.map(() => html`<span class="chip"><span class="bar chip-bar"></span></span>`)}
          </div>
          <div class="plate">the option, drawn</div>
        </div>

        <div class="dock">
          <div class="thread">
            ${TURNS.map(turn)}
            <p class="act live">
              <span class="dot"></span>
              <span class="action">${LIVE.action}</span>
              <span class="detail">${LIVE.detail}</span>
            </p>
          </div>

          <div class="composer">
            <div class="prompt">${DRAFT}</div>
            <div class="status">
              <span class="cli">${CLI}</span>
              <span class="meter">
                <span class="session">${SESSION.id}</span>
                <span class="track"><span class="fill" style="width: ${FILL}%"></span></span>
                <span class="used">${USED}</span>
              </span>
              <span class="send">Send</span>
            </div>
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
      width: 20rem;
      flex: none;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    .search {
      padding: 0.8rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .calls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .call {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.4rem;
    }

    .call.open {
      background: ${PLATE};
    }

    .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .headline {
      font-size: 1.3rem;
      line-height: 1.3;
    }

    .settled {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    .eyebrow-bar {
      width: 4.8rem;
      height: 0.6rem;
    }

    .headline-bar {
      width: 100%;
      height: 1.2rem;
    }

    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .stage {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-height: 0;
      padding: 1.6rem;
    }

    .chips {
      display: flex;
      gap: 0.8rem;
    }

    .chip {
      display: flex;
      align-items: center;
      height: 2.8rem;
      padding: 0 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 1.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    .chip.open {
      background: ${PLATE};
      color: ${INK};
    }

    .chip-bar {
      width: 7.2rem;
      height: 0.8rem;
    }

    .plate {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-height: 0;
      border: 1px solid ${LINE};
      background: ${PLATE};
      font-size: 1.2rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .dock {
      display: flex;
      flex-direction: column;
      height: 26rem;
      flex: none;
      border-top: 1px solid ${LINE};
    }

    .thread {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: flex-end;
      gap: 1rem;
      min-height: 0;
      overflow: hidden;
      padding: 1.6rem 1.6rem 0.8rem;
    }

    .thread p {
      margin: 0;
    }

    .ask {
      max-width: 96rem;
      margin-left: 2.4rem;
      padding-left: 1.2rem;
      border-left: 2px solid ${MUTED};
      font-size: 1.4rem;
      line-height: 1.5;
    }

    .say {
      max-width: 96rem;
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    .act {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 1.2rem;
      line-height: 1.4;
    }

    .action {
      color: ${INK};
    }

    .detail {
      color: ${MUTED};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .live .action {
      color: ${ACCENT};
    }

    .dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: ${ACCENT};
    }

    .composer {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      flex: none;
      padding: 0.8rem 1.6rem 1.6rem;
    }

    .prompt {
      padding: 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
      font-size: 1.4rem;
      line-height: 1.4;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 1.6rem;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .cli {
      flex: 1;
    }

    .meter {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      font-variant-numeric: tabular-nums;
    }

    .track {
      display: block;
      width: 12rem;
      height: 0.4rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    .fill {
      display: block;
      height: 100%;
      border-radius: 0.2rem;
      background: ${MUTED};
    }

    .send {
      padding: 0.6rem 1.6rem;
      border-radius: 0.4rem;
      background: ${ACCENT};
      color: ${GROUND};
      font-family: 'Jost', sans-serif;
      font-size: 1.2rem;
    }
  `,
});
