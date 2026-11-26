export type QueueItem = 'decision' | 'run' | 'change';
import { css, drawing, html } from '@design-explore';

export const queueItem = ({ mode }: { mode: QueueItem }) => {
  const label = mode === 'decision' ? 'DECISION' : mode === 'run' ? 'AGENT RUN' : 'CHANGE SET';
  const title =
    mode === 'decision' ? 'Choose a comparison home' : mode === 'run' ? 'Build the candidate' : 'Review the changes';
  const intro = 'A bounded piece of work waiting in the queue.';
  const left = 'OWNER';
  const right = 'STATUS';
  const detail = 'Ready';
  const action = mode === 'decision' ? 'Decide' : 'Open';
  const copy = () => intro;
  const name = () => title;

  return drawing({
    body: html`<div class="qi">
      <header><b>DECISION QUEUE</b><span>3 open · 12 settled</span><small>↑ ↓ next</small></header>
      <main>
        <aside>
          <span>NOW</span><b class="${true && 'active'}">${name()}</b><b>Lane width</b><b>Timeline chrome</b>
        </aside>
        <section>
          <span>${label}</span>
          <h1>${title}</h1>
          <p>${intro}</p>
          <div class="body">
            <article><b>${left}</b><small>${detail}</small></article>
            <article class="selected"><b>${right}</b><small>${detail}</small></article>
          </div>
          <footer><button>← Back</button><button class="go">${action} →</button></footer>
        </section>
      </main>
    </div>`,
    styles: css`
      .qi {
        min-height: 620px;
        background: #171717;
        color: #ddd7ca;
        font:
          13px/1.45 ui-monospace,
          SFMono-Regular,
          monospace;
      }
      .qi header {
        display: flex;
        gap: 20px;
        padding: 16px 22px;
        border-bottom: 1px solid #3c3932;
      }
      .qi header b {
        letter-spacing: 0.12em;
      }
      .qi header span {
        color: #aaa396;
      }
      .qi header small {
        margin-left: auto;
        color: #8ed2bb;
      }
      .qi main {
        display: grid;
        grid-template-columns: 210px 1fr;
        min-height: 568px;
      }
      .qi aside {
        display: flex;
        flex-direction: column;
        gap: 11px;
        padding: 25px 15px;
        border-right: 1px solid #3c3932;
      }
      .qi aside span,
      .qi section > span {
        color: #8ed2bb;
        font-size: 10px;
        letter-spacing: 0.1em;
      }
      .qi aside b {
        padding: 10px;
        color: #aaa396;
      }
      .qi aside .active {
        border-left: 2px solid #8ed2bb;
        background: #24241f;
        color: #eee8dc;
      }
      .qi section {
        padding: 42px;
      }
      .qi h1 {
        margin: 9px 0;
        color: #f0eadf;
        font: 500 26px/1.2 system-ui;
      }
      .qi p {
        max-width: 600px;
        color: #aaa396;
        font: 15px/1.6 system-ui;
      }
      .body {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 34px;
      }
      .body article {
        display: flex;
        flex-direction: column;
        min-height: 175px;
        padding: 18px;
        border: 1px solid #454039;
        background: #211f1b;
      }
      .body article.selected {
        border-color: #8ed2bb;
        background: #222b25;
      }
      .body article b {
        color: #eee8dc;
        font: 500 18px system-ui;
      }
      .body article small {
        margin-top: auto;
        color: #aaa396;
      }
      footer {
        display: flex;
        justify-content: space-between;
        margin-top: 18px;
      }
      button {
        padding: 9px 12px;
        border: 1px solid #5d7768;
        background: #222c25;
        color: #ace0cc;
        font: inherit;
      }
      .go {
        background: #8ed2bb;
        color: #17211b;
      }
    `,
  });
};
