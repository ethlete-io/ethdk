import { css, drawing, html } from '@design-explore';
import { chat } from './chat';

export default drawing({
  body: html`
    <div class="chat-a et-surface--dark et-color--brand">
      <header class="chat-a__head">
        <span class="chat-a__eyebrow">${chat.call.eyebrow}</span>
        <span class="chat-a__agent">${chat.agent}</span>
      </header>

      <div class="chat-a__thread">
        ${chat.turns.map(
          (turn) => html`
            <article class="chat-a__turn chat-a__turn--${turn.who}">
              <div class="chat-a__meta">
                <span class="chat-a__who">${turn.who === 'agent' ? 'Agent' : 'You'}</span>
                ${turn.verb && html`<span class="chat-a__verb">${turn.verb}</span>`}
                <span class="chat-a__at">${turn.at}</span>
              </div>
              <p class="chat-a__text">${turn.text}</p>
            </article>
          `,
        )}
      </div>

      <div class="chat-a__composer">
        <div class="chat-a__input">
          <p class="chat-a__draft">
            ${chat.draft}<i class="chat-a__caret"></i><span class="chat-a__rest">${chat.placeholder}</span>
          </p>
        </div>
        <div class="chat-a__actions">
          <button class="chat-a__send">Send</button>
        </div>
      </div>
    </div>
  `,
  styles: css`
    .chat-a {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 38rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.5 'Jost',
        system-ui,
        sans-serif;
    }
    .chat-a button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .chat-a__head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
      padding: 1.4rem 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .chat-a__eyebrow,
    .chat-a__agent,
    .chat-a__at {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .chat-a__thread {
      display: grid;
      align-content: end;
      gap: 2.4rem;
      min-height: 0;
      padding: 2.4rem 1.6rem;
      overflow: hidden;
    }
    .chat-a__turn {
      display: grid;
      gap: 0.6rem;
    }
    .chat-a__turn--you {
      justify-items: end;
      padding-left: 3.2rem;
    }
    .chat-a__meta {
      display: flex;
      gap: 0.8rem;
      align-items: center;
    }
    .chat-a__who {
      color: var(--et-surface-color-muted-solid);
      font-weight: 500;
      font-size: 1.1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-a__turn--you .chat-a__who {
      color: var(--et-theme-color-ink-solid);
    }
    .chat-a__verb {
      padding: 0.2rem 0.7rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.18);
      color: var(--et-theme-color-ink-solid);
      font-size: 1.1rem;
      line-height: 1.5;
    }
    .chat-a__text {
      margin: 0;
      font-size: 1.35rem;
    }
    .chat-a__turn--agent .chat-a__text {
      padding-left: 1.2rem;
      border-left: 0.2rem solid var(--et-surface-border-solid);
      color: var(--et-surface-color-muted-solid);
    }
    .chat-a__turn--you .chat-a__text {
      padding: 1rem 1.2rem;
      border-radius: 0.8rem 0.8rem 0.2rem 0.8rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.14);
      color: var(--et-surface-color-solid);
    }
    .chat-a__composer {
      display: grid;
      gap: 1rem;
      padding: 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .chat-a__input {
      min-height: 9rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-theme-color-primary-solid);
      border-radius: 0.6rem;
      background: rgb(var(--et-surface-color-rgb) / 0.05);
    }
    .chat-a__draft {
      margin: 0;
      color: var(--et-surface-color-solid);
      font-size: 1.35rem;
    }
    .chat-a__caret {
      display: inline-block;
      width: 0.15rem;
      height: 1.6rem;
      background: var(--et-theme-color-primary-solid);
      vertical-align: text-bottom;
      animation: chat-a-blink 1.1s steps(1, end) infinite;
    }
    .chat-a__rest {
      color: var(--et-surface-color-subtle-solid);
      opacity: 0.45;
    }
    .chat-a__actions {
      display: flex;
      justify-content: end;
    }
    .chat-a__send {
      padding: 0.7rem 1.6rem;
      border-radius: 0.4rem;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
      font-size: 1.3rem;
    }
    @keyframes chat-a-blink {
      50% {
        opacity: 0;
      }
    }
  `,
});
