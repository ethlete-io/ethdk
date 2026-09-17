import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, CLI, DRAFT, GROUND, INK, LINE, LIVE, MUTED, PLATE, SESSION, TURNS } from './fixture';

@Component({
  selector: 'ethlete-design-chat-c',
  template: `
    @for (state of STATES; track state.label) {
      <p class="state-label">{{ state.label }}</p>

      <div class="win">
        <div class="rail">
          <div class="search"></div>

          <div class="call-row">
            <span class="bar bar-eyebrow"></span>
            <span class="bar bar-headline"></span>
            <span class="bar bar-settled"></span>
          </div>

          <div class="call-row is-current">
            <span class="eyebrow">{{ CALL.project }} · call 0</span>
            <span class="call-headline">{{ CALL.headline }}</span>
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
            <span class="chip is-current">{{ CALL.option }}</span>
            <span class="chip"><span class="bar bar-chip"></span></span>
            <span class="chip"><span class="bar bar-chip"></span></span>
          </div>

          <div [class.is-open]="state.open" class="canvas">
            <div class="drawing">
              <span class="drawing-label">the drawn component</span>
            </div>

            @if (state.open) {
              <div class="drawer">
                <div class="drawer-head">
                  <span>the conversation</span>
                  <span>close</span>
                </div>

                <div class="turns">
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
                          <span class="act-name">{{ turn.action }}</span>
                          <span class="act-detail">{{ turn.detail }}</span>
                        </p>
                      }
                    }
                  }

                  <p class="act is-live">
                    <span class="act-name">{{ LIVE.action }}</span>
                    <span class="act-detail">{{ LIVE.detail }}</span>
                  </p>
                </div>
              </div>
            }
          </div>

          <div class="prompt">{{ DRAFT }}</div>

          <div class="status">
            <span class="live">
              <span class="act-name">{{ LIVE.action }}</span>
              <span class="act-detail">{{ LIVE.detail }}</span>
            </span>
            <span class="turns-control">{{ TURNS.length }} turns</span>
            <span class="cli">{{ CLI }}</span>
            <span class="meter">
              <span class="session">{{ SESSION.id }}</span>
              <span class="meter-bar"><span [style.width.%]="FILL" class="meter-fill"></span></span>
              <span class="used">{{ USED }}</span>
            </span>
            <span class="send">Send</span>
          </div>
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-chat-c {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-chat-c .state-label {
      margin: 0;
      padding: 1.6rem 1.6rem 0.8rem;
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-c .win {
      display: flex;
      height: 72rem;
      border-top: 1px solid ${LINE};
      border-bottom: 1px solid ${LINE};
      background: ${GROUND};
      overflow: hidden;
    }

    ethlete-design-chat-c .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 20rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-chat-c .search {
      height: 3.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    ethlete-design-chat-c .call-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.6rem;
    }

    ethlete-design-chat-c .call-row.is-current {
      background: ${PLATE};
    }

    ethlete-design-chat-c .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-c .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
      color: ${INK};
    }

    ethlete-design-chat-c .settled {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-chat-c .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.4rem;
      background: ${LINE};
    }

    ethlete-design-chat-c .bar-eyebrow {
      width: 45%;
      height: 0.6rem;
    }

    ethlete-design-chat-c .bar-headline {
      width: 85%;
      height: 1rem;
    }

    ethlete-design-chat-c .bar-settled {
      width: 55%;
      height: 0.6rem;
    }

    ethlete-design-chat-c .main {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-chat-c .chips {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-chat-c .chip {
      display: flex;
      align-items: center;
      min-width: 9rem;
      padding: 0.6rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-chat-c .chip.is-current {
      min-width: 0;
      background: ${PLATE};
      border-color: ${MUTED};
      color: ${INK};
    }

    ethlete-design-chat-c .bar-chip {
      width: 100%;
      height: 0.6rem;
    }

    ethlete-design-chat-c .canvas {
      position: relative;
      flex: 1;
      min-height: 0;
    }

    ethlete-design-chat-c .drawing {
      display: grid;
      place-items: center;
      height: 100%;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
    }

    ethlete-design-chat-c .canvas.is-open .drawing {
      opacity: 0.35;
    }

    ethlete-design-chat-c .drawing-label {
      font-size: 1.1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-c .drawer {
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

    ethlete-design-chat-c .drawer-head {
      display: flex;
      justify-content: space-between;
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-chat-c .turns {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      min-height: 0;
    }

    ethlete-design-chat-c .turns p {
      margin: 0;
    }

    ethlete-design-chat-c .ask {
      padding-left: 1.4rem;
      border-left: 2px solid ${ACCENT};
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    ethlete-design-chat-c .say {
      max-width: 64rem;
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    ethlete-design-chat-c .act {
      display: flex;
      gap: 1rem;
      font-family: 'Jetbrains Mono', ui-monospace, monospace;
      font-size: 1.2rem;
      color: ${INK};
    }

    ethlete-design-chat-c .act-detail {
      color: ${MUTED};
    }

    ethlete-design-chat-c .act.is-live,
    ethlete-design-chat-c .act.is-live .act-detail {
      color: ${ACCENT};
    }

    ethlete-design-chat-c .act.is-live .act-detail {
      opacity: 0.7;
    }

    ethlete-design-chat-c .prompt {
      padding: 1.4rem 1.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
      font-size: 1.4rem;
      line-height: 1.5;
      color: ${INK};
    }

    ethlete-design-chat-c .status {
      display: flex;
      align-items: center;
      gap: 1.6rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-chat-c .live {
      display: flex;
      gap: 1rem;
      flex: 1;
      min-width: 0;
      font-family: 'Jetbrains Mono', ui-monospace, monospace;
      color: ${ACCENT};
    }

    ethlete-design-chat-c .live .act-detail {
      color: ${ACCENT};
      opacity: 0.7;
    }

    ethlete-design-chat-c .turns-control {
      padding: 0.4rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      color: ${MUTED};
    }

    ethlete-design-chat-c .meter {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-chat-c .meter-bar {
      display: block;
      width: 8rem;
      height: 0.4rem;
      border-radius: 999px;
      background: ${LINE};
      overflow: hidden;
    }

    ethlete-design-chat-c .meter-fill {
      display: block;
      height: 100%;
      background: ${MUTED};
    }

    ethlete-design-chat-c .send {
      padding: 0.5rem 1.4rem;
      border: 1px solid ${MUTED};
      border-radius: 0.6rem;
      color: ${INK};
    }
  `,
})
export default class ChatSurfaceOptionCComponent {
  protected readonly TURNS = TURNS;
  protected readonly LIVE = LIVE;
  protected readonly DRAFT = DRAFT;
  protected readonly SESSION = SESSION;
  protected readonly CLI = CLI;
  protected readonly CALL = CALL;

  protected readonly STATES = [
    { label: 'Closed', open: false },
    { label: 'Open', open: true },
  ];

  protected readonly FILL = (SESSION.tokens / SESSION.limit) * 100;
  protected readonly USED = `${Math.round(SESSION.tokens / 1000)}k`;
}
