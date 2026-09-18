import { css, drawing, html } from '@design-explore';
import { ChatTurn, chat } from './chat';

const verb = chat.verbs.find((entry) => entry === 'Reject');
const current = chat.variants.find((variant) => variant.current);

const turn = (entry: ChatTurn) => html`
  <article class="chat-c__turn chat-c__turn--${entry.who}">
    <div class="chat-c__turn-meta">
      <b>${entry.who === 'agent' ? 'Agent' : 'You'}</b>
      ${entry.verb && html`<span class="chat-c__turn-verb">${entry.verb}</span>`}
      <span class="chat-c__turn-at">${entry.at}</span>
    </div>
    <p>${entry.text}</p>
  </article>
`;

export default drawing({
  body: html`
    <div class="chat-c et-surface--dark-elevated et-color--brand">
      <header class="chat-c__head">
        <div class="chat-c__head-row">
          <b>Chat</b>
          <span class="chat-c__eyebrow">${chat.call.eyebrow}</span>
        </div>
        <div class="chat-c__agent"><i class="chat-c__dot"></i>${chat.agent}</div>
      </header>

      <div class="chat-c__thread">${chat.turns.map(turn)}</div>

      <div class="chat-c__foot">
        <div class="chat-c__lift"></div>

        <section class="chat-c__card et-surface--dark-elevated-2">
          <header class="chat-c__card-head">
            <b>Compose</b>
            <button class="chat-c__dismiss">
              <svg viewBox="0 0 24 24">
                <path d="m7 7 10 10" />
                <path d="M17 7 7 17" />
              </svg>
            </button>
          </header>

          <div class="chat-c__field">
            <span class="chat-c__label">Verb</span>
            <span class="chat-c__verb">${verb}</span>
          </div>

          <div class="chat-c__field">
            <span class="chat-c__label">Option</span>
            <div class="chat-c__stated">
              <span class="chat-c__variant">${current?.name}</span>
              <span class="chat-c__round">${current?.round}</span>
            </div>
            <span class="chat-c__fixed">stated by the verb press, not typed</span>
          </div>

          <div class="chat-c__field">
            <span class="chat-c__label">Message</span>
            <div class="chat-c__box">${chat.draft}<i class="chat-c__caret"></i></div>
          </div>

          <footer class="chat-c__card-foot">
            <button class="chat-c__send">Send</button>
          </footer>
        </section>

        <div class="chat-c__input-off">
          <span>${chat.placeholder}</span>
          <span class="chat-c__input-off-tag">closed</span>
        </div>
      </div>
    </div>
  `,
  styles: css`
    .chat-c {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 100%;
      min-height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .chat-c button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .chat-c svg {
      width: 1.4rem;
      height: 1.4rem;
      stroke: currentcolor;
      stroke-width: 1.8;
      fill: none;
    }
    .chat-c__eyebrow,
    .chat-c__agent,
    .chat-c__turn-at,
    .chat-c__round,
    .chat-c__fixed,
    .chat-c__input-off-tag {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .chat-c__head {
      display: grid;
      gap: 0.6rem;
      padding: 1.6rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
    }
    .chat-c__head-row {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }
    .chat-c__head-row b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-c__eyebrow {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chat-c__agent {
      display: flex;
      gap: 0.6rem;
      align-items: center;
    }
    .chat-c__dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--et-theme-color-primary-solid);
    }
    .chat-c__thread {
      display: grid;
      align-content: end;
      gap: 1.8rem;
      min-height: 0;
      padding: 2rem 1.6rem 1.2rem;
      overflow: hidden;
    }
    .chat-c__turn p {
      margin: 0;
      font-size: 1.3rem;
      line-height: 1.5;
    }
    .chat-c__turn-meta {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      padding-bottom: 0.5rem;
    }
    .chat-c__turn-meta b {
      font-weight: 500;
      font-size: 1.1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-c__turn-at {
      margin-left: auto;
    }
    .chat-c__turn--agent {
      padding-left: 1rem;
      border-left: 0.2rem solid var(--et-surface-border-solid);
    }
    .chat-c__turn--agent .chat-c__turn-meta b {
      color: var(--et-surface-color-muted-solid);
    }
    .chat-c__turn--agent p {
      color: var(--et-surface-color-muted-solid);
    }
    .chat-c__turn--you {
      margin-left: 2.8rem;
      padding: 1rem 1.2rem 1.1rem;
      border: 0.1rem solid rgb(var(--et-theme-color-primary-rgb) / 0.3);
      border-radius: 0.8rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.1);
    }
    .chat-c__turn--you .chat-c__turn-meta b {
      color: var(--et-theme-color-ink-solid);
    }
    .chat-c__turn-verb {
      padding: 0.1rem 0.6rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.22);
      color: var(--et-theme-color-ink-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-c__foot {
      --chat-c-below: var(--et-surface-background-rgb);

      display: grid;
      gap: 1rem;
      padding: 0 1.6rem 1.6rem;
    }
    .chat-c__lift {
      height: 2.4rem;
      margin: -2.4rem -1.6rem -1rem;
      background: linear-gradient(to bottom, transparent, var(--et-surface-background-solid));
    }
    .chat-c__card {
      display: grid;
      gap: 1.2rem;
      padding: 1.4rem;
      border: 0.1rem solid var(--et-surface-border-solid);
      border-radius: 0.9rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      box-shadow: 0 -0.2rem 2.4rem rgb(var(--chat-c-below) / 0.9);
    }
    .chat-c__card-head {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }
    .chat-c__card-head b {
      font-weight: 500;
      font-size: 1.2rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-c__dismiss {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      margin: -0.4rem -0.4rem -0.4rem 0;
      border-radius: 0.4rem;
      background: rgb(var(--et-surface-color-rgb) / 0.06);
      color: var(--et-surface-color-muted-solid);
    }
    .chat-c__field {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
    .chat-c__label {
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-c__verb {
      padding: 0.4rem 1rem;
      border-radius: 0.4rem;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
      font-size: 1.3rem;
    }
    .chat-c__stated {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      justify-self: stretch;
      padding: 0.7rem 1rem;
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.06);
    }
    .chat-c__variant {
      font-size: 1.3rem;
      line-height: 1.35;
    }
    .chat-c__round {
      margin-left: auto;
    }
    .chat-c__box {
      justify-self: stretch;
      min-height: 7.2rem;
      padding: 0.9rem 1.1rem;
      border: 0.1rem solid var(--et-theme-color-primary-solid);
      border-radius: 0.5rem;
      background: rgb(var(--et-surface-color-rgb) / 0.04);
      font-size: 1.3rem;
      line-height: 1.5;
    }
    .chat-c__caret {
      display: inline-block;
      width: 0.1rem;
      height: 1.5rem;
      background: var(--et-theme-color-primary-solid);
      vertical-align: text-bottom;
    }
    .chat-c__card-foot {
      display: flex;
      justify-content: end;
    }
    .chat-c__send {
      padding: 0.7rem 1.6rem;
      border-radius: 0.4rem;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
      font-size: 1.3rem;
    }
    .chat-c__input-off {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.2rem;
      border: 0.1rem dashed var(--et-surface-border-solid);
      border-radius: 0.6rem;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.3rem;
      opacity: 0.55;
    }
    .chat-c__input-off span:first-child {
      text-decoration: line-through;
    }
    .chat-c__input-off-tag {
      text-transform: uppercase;
    }
  `,
});
