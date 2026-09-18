import { css, drawing, html } from '@design-explore';
import { chat } from './chat';

const verdictLabel: Record<string, string> = { '': 'open', chosen: 'chosen', rejected: 'rejected' };

const rounds = [...new Set(chat.variants.map((variant) => variant.round))].map((round) => ({
  label: `Round ${round.replace(/^r/, '')}`,
  variants: chat.variants.filter((variant) => variant.round === round),
}));

const mark = (verdict: string) => {
  if (verdict === 'chosen') return html`<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" /></svg>`;
  if (verdict === 'rejected') return html`<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>`;

  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>`;
};

export default drawing({
  body: html`
    <div class="chat-b et-surface--dark et-color--brand">
      <header class="chat-b__head et-surface--dark-elevated">
        <span class="chat-b__eyebrow">${chat.call.eyebrow}</span>
        <h2>${chat.call.headline}</h2>
        <span class="chat-b__round">${chat.call.round}</span>

        <div class="chat-b__variants">
          ${rounds.map(
            (round) => html`
              <section class="chat-b__variant-group">
                <span class="chat-b__group-label">${round.label}</span>
                ${round.variants.map(
                  (variant) => html`
                    <div
                      class="chat-b__variant chat-b__variant--${variant.verdict || 'open'}${
                        variant.current && ' chat-b__variant--current'
                      }"
                    >
                      <span class="chat-b__mark">${mark(variant.verdict)}</span>
                      <span class="chat-b__variant-name">${variant.name}</span>
                      ${variant.current && html`<span class="chat-b__on-screen">on screen</span>`}
                      <span class="chat-b__verdict">${verdictLabel[variant.verdict] ?? 'open'}</span>
                    </div>
                  `,
                )}
              </section>
            `,
          )}
        </div>
      </header>

      <div class="chat-b__thread">
        ${chat.turns.map(
          (turn) => html`
            <article class="chat-b__turn chat-b__turn--${turn.who}">
              <header class="chat-b__turn-head">
                <b>${turn.who === 'agent' ? chat.agent : turn.who}</b>
                <span>${turn.at}</span>
              </header>
              ${turn.verb && html`<span class="chat-b__verb">${turn.verb}</span>`}
              <p>${turn.text}</p>
            </article>
          `,
        )}

        <span class="chat-b__rail"><i></i></span>
      </div>

      <footer class="chat-b__foot">
        <div class="chat-b__input">
          <span class="chat-b__draft">${chat.draft}</span>
          <i class="chat-b__caret"></i>
        </div>
        <button class="chat-b__send">Send</button>
      </footer>
    </div>
  `,
  styles: css`
    .chat-b {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      width: 38rem;
      height: 90rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      font:
        400 1.4rem/1.45 'Jost',
        system-ui,
        sans-serif;
    }
    .chat-b button {
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .chat-b svg {
      width: 1.3rem;
      height: 1.3rem;
      stroke: currentcolor;
      stroke-width: 2;
      fill: none;
    }
    .chat-b__head {
      display: grid;
      align-content: start;
      gap: 0.5rem;
      padding: 1.8rem 1.6rem 1.4rem;
      border-bottom: 0.1rem solid var(--et-surface-border-solid);
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .chat-b__head h2 {
      margin: 0;
      font:
        500 1.7rem/1.3 'Jost',
        system-ui,
        sans-serif;
    }
    .chat-b__eyebrow {
      color: var(--et-theme-color-ink-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .chat-b__round {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
    }
    .chat-b__variants {
      display: grid;
      gap: 1.2rem;
      margin-top: 1rem;
      padding-top: 1.2rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
    }
    .chat-b__variant-group {
      display: grid;
      gap: 0.3rem;
    }
    .chat-b__group-label {
      padding: 0 0.7rem 0.3rem;
      color: var(--et-surface-color-subtle-solid);
      font-size: 1.05rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .chat-b__variant {
      display: flex;
      gap: 0.7rem;
      align-items: center;
      padding: 0.45rem 0.7rem;
      border-left: 0.2rem solid transparent;
      border-radius: 0.4rem;
    }
    .chat-b__mark {
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background: rgb(var(--et-surface-color-rgb) / 0.08);
      color: var(--et-surface-color-subtle-solid);
    }
    .chat-b__variant-name {
      flex: 1;
      min-width: 0;
      color: var(--et-surface-color-muted-solid);
      font-size: 1.2rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chat-b__verdict {
      color: var(--et-surface-color-subtle-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .chat-b__variant--chosen .chat-b__mark {
      background: rgb(var(--et-theme-color-primary-rgb) / 0.2);
      color: var(--et-theme-color-ink-solid);
    }
    .chat-b__variant--chosen .chat-b__verdict {
      color: var(--et-theme-color-ink-solid);
    }
    .chat-b__variant--rejected {
      opacity: 0.45;
    }
    .chat-b__variant--current {
      border-left-color: var(--et-theme-color-primary-solid);
      background: rgb(var(--et-theme-color-primary-rgb) / 0.12);
    }
    .chat-b__variant--current .chat-b__variant-name {
      color: var(--et-surface-color-solid);
      font-weight: 500;
    }
    .chat-b__on-screen {
      padding: 0.15rem 0.5rem;
      border-radius: 0.3rem;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .chat-b__thread {
      position: relative;
      display: grid;
      align-content: start;
      gap: 1.6rem;
      min-height: 0;
      padding: 1.8rem 2rem 1.8rem 1.6rem;
      overflow: hidden;
    }
    .chat-b__rail {
      position: absolute;
      top: 1.8rem;
      right: 0.6rem;
      bottom: 1.8rem;
      width: 0.3rem;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.07);
    }
    .chat-b__rail i {
      position: absolute;
      top: 22%;
      right: 0;
      left: 0;
      height: 66%;
      border-radius: 0.2rem;
      background: rgb(var(--et-surface-color-rgb) / 0.22);
    }
    .chat-b__turn {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }
    .chat-b__turn p {
      margin: 0;
      font-size: 1.3rem;
      line-height: 1.5;
    }
    .chat-b__turn-head {
      display: flex;
      gap: 0.8rem;
      align-items: baseline;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1.05rem;
      letter-spacing: 0.02em;
    }
    .chat-b__turn-head b {
      font-weight: 400;
    }
    .chat-b__turn-head span {
      color: var(--et-surface-color-subtle-solid);
    }
    .chat-b__turn--agent {
      padding-left: 1.1rem;
      border-left: 0.2rem solid var(--et-surface-border-solid);
    }
    .chat-b__turn--agent .chat-b__turn-head b {
      color: var(--et-surface-color-subtle-solid);
    }
    .chat-b__turn--agent p {
      color: var(--et-surface-color-muted-solid);
    }
    .chat-b__turn--you {
      justify-self: end;
      max-width: 90%;
      padding: 0.9rem 1.1rem;
      border-radius: 1rem 1rem 0.3rem 1rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.14);
      box-shadow: inset 0 0 0 0.1rem rgb(var(--et-theme-color-primary-rgb) / 0.3);
    }
    .chat-b__turn--you .chat-b__turn-head b {
      color: var(--et-theme-color-ink-solid);
    }
    .chat-b__turn--you p {
      color: var(--et-surface-color-solid);
    }
    .chat-b__verb {
      padding: 0.2rem 0.6rem;
      border-radius: 0.3rem;
      background: rgb(var(--et-theme-color-primary-rgb) / 0.28);
      color: var(--et-theme-color-ink-solid);
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 1rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .chat-b__foot {
      display: grid;
      justify-items: end;
      gap: 1rem;
      padding: 1.4rem 1.6rem 1.6rem;
      border-top: 0.1rem solid var(--et-surface-border-solid);
      background: rgb(var(--et-surface-color-rgb) / 0.03);
    }
    .chat-b__input {
      display: flex;
      align-items: flex-start;
      justify-self: stretch;
      min-height: 7.6rem;
      padding: 1rem 1.2rem;
      border: 0.1rem solid var(--et-theme-color-primary-solid);
      border-radius: 0.8rem;
      background: var(--et-surface-background-solid);
      font-size: 1.3rem;
      line-height: 1.5;
    }
    .chat-b__draft {
      color: var(--et-surface-color-solid);
      white-space: pre-wrap;
    }
    .chat-b__caret {
      width: 0.15rem;
      height: 1.9rem;
      background: var(--et-theme-color-ink-solid);
    }
    .chat-b__send {
      padding: 0.7rem 1.6rem;
      border-radius: 0.4rem;
      background: var(--et-theme-color-primary-solid);
      color: var(--et-theme-color-on-primary-solid);
      font-weight: 500;
      font-size: 1.3rem;
    }
  `,
});
