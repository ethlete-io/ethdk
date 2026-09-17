import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS } from './fixture';

@Component({
  selector: 'ethlete-design-chat-b',
  template: `
    <div class="window">
      <div class="rail">
        <div class="search">Search</div>
        <div class="calls">
          <div class="call open">
            <span class="eyebrow">{{ CALL.project }}</span>
            <span class="headline">{{ CALL.headline }}</span>
            <span class="settled">0 of 6 settled</span>
          </div>
          @for (row of GHOSTS; track row) {
            <div class="call">
              <span class="bar eyebrow-bar"></span>
              <span class="bar headline-bar"></span>
              <span class="settled">0 of 6 settled</span>
            </div>
          }
        </div>
      </div>

      <div class="main">
        <div class="stage">
          <div class="chips">
            <span class="chip open">{{ CALL.option }}</span>
            @for (chip of GHOSTS; track chip) {
              <span class="chip"><span class="bar chip-bar"></span></span>
            }
          </div>
          <div class="plate">the option, drawn</div>
        </div>

        <div class="dock">
          <div class="thread">
            @for (turn of TURNS; track $index) {
              @switch (turn.kind) {
                @case ('ask') {
                  <p class="ask">{{ turn.text }}</p>
                }
                @case ('say') {
                  <p class="say">{{ turn.text }}</p>
                }
                @case ('act') {
                  <p class="act">
                    <span class="action">{{ turn.action }}</span>
                    <span class="detail">{{ turn.detail }}</span>
                  </p>
                }
              }
            }
            <p class="act live">
              <span class="dot"></span>
              <span class="action">{{ LIVE.action }}</span>
              <span class="detail">{{ LIVE.detail }}</span>
            </p>
          </div>

          <div class="composer">
            <div class="prompt">{{ DRAFT }}</div>
            <div class="status">
              <span class="cli">{{ CLI }}</span>
              <span class="meter">
                <span class="session">{{ SESSION.id }}</span>
                <span class="track"><span class="fill" [style.width.%]="FILL"></span></span>
                <span class="used">{{ USED }}</span>
              </span>
              <span class="send">Send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-chat-b {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-chat-b .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-chat-b .rail {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      width: 20rem;
      flex: none;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-chat-b .search {
      padding: 0.8rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-chat-b .calls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    ethlete-design-chat-b .call {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.4rem;
    }

    ethlete-design-chat-b .call.open {
      background: ${PLATE};
    }

    ethlete-design-chat-b .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-b .headline {
      font-size: 1.3rem;
      line-height: 1.3;
    }

    ethlete-design-chat-b .settled {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-chat-b .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    ethlete-design-chat-b .eyebrow-bar {
      width: 4.8rem;
      height: 0.6rem;
    }

    ethlete-design-chat-b .headline-bar {
      width: 100%;
      height: 1.2rem;
    }

    ethlete-design-chat-b .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    ethlete-design-chat-b .stage {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-height: 0;
      padding: 1.6rem;
    }

    ethlete-design-chat-b .chips {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-chat-b .chip {
      display: flex;
      align-items: center;
      height: 2.8rem;
      padding: 0 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 1.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-chat-b .chip.open {
      background: ${PLATE};
      color: ${INK};
    }

    ethlete-design-chat-b .chip-bar {
      width: 7.2rem;
      height: 0.8rem;
    }

    ethlete-design-chat-b .plate {
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

    ethlete-design-chat-b .dock {
      display: flex;
      flex-direction: column;
      height: 26rem;
      flex: none;
      border-top: 1px solid ${LINE};
    }

    ethlete-design-chat-b .thread {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: flex-end;
      gap: 1rem;
      min-height: 0;
      overflow: hidden;
      padding: 1.6rem 1.6rem 0.8rem;
    }

    ethlete-design-chat-b .thread p {
      margin: 0;
    }

    ethlete-design-chat-b .ask {
      max-width: 96rem;
      margin-left: 2.4rem;
      padding-left: 1.2rem;
      border-left: 2px solid ${MUTED};
      font-size: 1.4rem;
      line-height: 1.5;
    }

    ethlete-design-chat-b .say {
      max-width: 96rem;
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    ethlete-design-chat-b .act {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 1.2rem;
      line-height: 1.4;
    }

    ethlete-design-chat-b .action {
      color: ${INK};
    }

    ethlete-design-chat-b .detail {
      color: ${MUTED};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    ethlete-design-chat-b .live .action {
      color: ${ACCENT};
    }

    ethlete-design-chat-b .dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: ${ACCENT};
    }

    ethlete-design-chat-b .composer {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      flex: none;
      padding: 0.8rem 1.6rem 1.6rem;
    }

    ethlete-design-chat-b .prompt {
      padding: 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
      font-size: 1.4rem;
      line-height: 1.4;
    }

    ethlete-design-chat-b .status {
      display: flex;
      align-items: center;
      gap: 1.6rem;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-chat-b .cli {
      flex: 1;
    }

    ethlete-design-chat-b .meter {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-chat-b .track {
      display: block;
      width: 12rem;
      height: 0.4rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    ethlete-design-chat-b .fill {
      display: block;
      height: 100%;
      border-radius: 0.2rem;
      background: ${MUTED};
    }

    ethlete-design-chat-b .send {
      padding: 0.6rem 1.6rem;
      border-radius: 0.4rem;
      background: ${ACCENT};
      color: ${GROUND};
      font-family: 'Jost', sans-serif;
      font-size: 1.2rem;
    }
  `,
})
export default class ChatSurfaceOptionBComponent {
  protected readonly TURNS = TURNS;
  protected readonly LIVE = LIVE;
  protected readonly DRAFT = DRAFT;
  protected readonly SESSION = SESSION;
  protected readonly CLI = CLI;
  protected readonly CALL = CALL;
  protected readonly GHOSTS = [1, 2];
  protected readonly FILL = (SESSION.tokens / SESSION.limit) * 100;
  protected readonly USED = `${Math.round(SESSION.tokens / 1000)}k`;
}
