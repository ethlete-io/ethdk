import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS } from './fixture';

@Component({
  selector: 'ethlete-design-chat-a',
  template: `
    <div class="window">
      <div class="rail">
        <div class="search"></div>
        @for (row of RAILS; track row.headline) {
          <div [class.on]="row.on" class="call">
            <span class="call-eyebrow">{{ row.eyebrow }}</span>
            <span class="call-headline">{{ row.headline }}</span>
            <span class="call-state">0 of 6 settled</span>
          </div>
        }
      </div>

      <div class="stage">
        <div class="chips">
          @for (chip of CHIPS; track chip) {
            <span [class.on]="chip === CALL.option" class="chip">{{ chip }}</span>
          }
        </div>
        <div class="plate">
          <span class="plate-label">the drawn option</span>
        </div>
      </div>

      <div class="chat">
        <div class="thread">
          @for (turn of TURNS; track $index) {
            @if (turn.kind === 'ask') {
              <p class="ask">{{ turn.text }}</p>
            } @else if (turn.kind === 'say') {
              <p class="say">{{ turn.text }}</p>
            } @else {
              <p class="act">
                <span class="act-action">{{ turn.action }}</span>
                <span class="act-detail">{{ turn.detail }}</span>
              </p>
            }
          }
          <p class="act live">
            <span class="act-action">{{ LIVE.action }}</span>
            <span class="act-detail">{{ LIVE.detail }}</span>
          </p>
        </div>

        <div class="foot">
          <div class="prompt">{{ DRAFT }}</div>
          <div class="bar">
            <span class="cli">{{ CLI }}</span>
            <span class="meter">
              <span class="meter-id">{{ SESSION.id }}</span>
              <span class="meter-track"><span [style.width.%]="FILLED" class="meter-fill"></span></span>
              <span class="meter-value">152k</span>
            </span>
            <span class="send">Send</span>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-chat-a {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-chat-a .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-chat-a .rail {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 0 0 20rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-chat-a .search {
      height: 2.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-chat-a .call {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    ethlete-design-chat-a .call.on {
      background: ${PLATE};
    }

    ethlete-design-chat-a .call-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-a .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    ethlete-design-chat-a .call-state {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-chat-a .stage {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-chat-a .chips {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-chat-a .chip {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-chat-a .chip.on {
      border-color: ${INK};
      color: ${INK};
    }

    ethlete-design-chat-a .plate {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 auto;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    ethlete-design-chat-a .plate-label {
      font-size: 1.2rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-a .chat {
      display: flex;
      flex-direction: column;
      flex: 0 0 34rem;
      min-height: 0;
      border-left: 1px solid ${LINE};
    }

    ethlete-design-chat-a .thread {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      flex: 1 1 auto;
      min-height: 0;
      padding: 1.6rem;
      overflow: hidden;
    }

    ethlete-design-chat-a .ask {
      margin: 0 0 0 1.2rem;
      padding-left: 1.2rem;
      border-left: 2px solid ${LINE};
      font-size: 1.3rem;
      line-height: 1.55;
      color: ${INK};
    }

    ethlete-design-chat-a .say {
      margin: 0;
      font-size: 1.3rem;
      line-height: 1.6;
      color: ${INK};
    }

    ethlete-design-chat-a .act {
      display: flex;
      gap: 0.8rem;
      margin: 0;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      line-height: 1.4;
      white-space: nowrap;
    }

    ethlete-design-chat-a .act-action {
      color: ${INK};
    }

    ethlete-design-chat-a .act-detail {
      overflow: hidden;
      text-overflow: ellipsis;
      color: ${MUTED};
    }

    ethlete-design-chat-a .live .act-action {
      color: ${ACCENT};
    }

    ethlete-design-chat-a .live .act-action::after {
      content: ' ·';
      color: ${ACCENT};
    }

    ethlete-design-chat-a .foot {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      padding: 1.6rem;
      border-top: 1px solid ${LINE};
    }

    ethlete-design-chat-a .prompt {
      min-height: 7.2rem;
      padding: 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
      font-size: 1.3rem;
      line-height: 1.5;
    }

    ethlete-design-chat-a .bar {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-chat-a .cli {
      white-space: nowrap;
    }

    ethlete-design-chat-a .meter {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }

    ethlete-design-chat-a .meter-track {
      flex: 1 1 auto;
      height: 0.3rem;
      border-radius: 999px;
      background: ${LINE};
    }

    ethlete-design-chat-a .meter-fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: ${MUTED};
    }

    ethlete-design-chat-a .send {
      padding: 0.5rem 1.4rem;
      border-radius: 0.4rem;
      background: ${ACCENT};
      color: ${GROUND};
      font-family: 'Jost', sans-serif;
      font-size: 1.2rem;
    }
  `,
})
export default class ChatSurfaceOptionAComponent {
  protected readonly TURNS = TURNS;
  protected readonly LIVE = LIVE;
  protected readonly DRAFT = DRAFT;
  protected readonly SESSION = SESSION;
  protected readonly CLI = CLI;
  protected readonly CALL = CALL;

  protected readonly CHIPS = ['B · A hairline frame and the change', CALL.option, 'E · The change goes quiet'];

  protected readonly RAILS = [
    { eyebrow: 'Sandbox · call 0', headline: CALL.headline, on: true },
    { eyebrow: 'Sandbox · call 1', headline: 'How a day names the work it holds', on: false },
    { eyebrow: 'Sandbox · call 2', headline: 'What a running entry looks like', on: false },
  ];

  protected readonly FILLED = (SESSION.tokens / SESSION.limit) * 100;
}
