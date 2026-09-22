export type NewCandidate = 'challenger' | 'round' | 'reset';
import { css, drawing, html } from '@design-explore';

export const newCandidate = ({ mode }: { mode: NewCandidate }) => {
  const eye = 'NEW CANDIDATE';
  const title =
    mode === 'challenger' ? 'A competing direction' : mode === 'round' ? 'A new round' : 'Reset the comparison';
  const copy = 'Bring the next option into the design conversation.';
  const candidate = 'Option D';

  return drawing({
    body: html`<div class="nc">
      <header>
        <b>COMPARE HOME</b
        ><span
          >${
            mode === 'challenger'
              ? 'SETTLED · NEW CHALLENGER'
              : mode === 'round'
                ? 'ROUND 3 · 1 NEW OPTION'
                : 'REOPENED · 6 OPTIONS'
          }</span
        ><small>history</small>
      </header>
      <main>
        <section>
          <span>${eye}</span>
          <h1>${title}</h1>
          <p>${copy}</p>
          <div class="cards">
            <article><b>A · Docked workbench</b><small>current winner</small></article>
            <article class="new">
              <b>${candidate}</b
              ><small
                >${mode === 'challenger' ? 'new · compare to winner' : mode === 'round' ? 'new round' : 'active again'}</small
              >
            </article>
            ${
              mode !== 'challenger' &&
              html` <article><b>C · Dedicated page</b><small>prior alternative</small></article> `
            }
          </div>
          <footer><button>Keep A</button><button>Compare ${candidate}</button></footer>
        </section>
        <aside>
          <span>DECISION HISTORY</span><b>01 · Compare home</b>
          <p>A docked workbench won the original review.</p>
          <b class="${mode !== 'challenger' && 'open'}"
            >${mode === 'challenger' ? '2 previous rounds folded' : '03 · New candidate'}</b
          >
          <p>
            ${
              mode === 'challenger'
                ? 'Open only when the new comparison needs context.'
                : 'The new work is mixed into previous history.'
            }
          </p>
        </aside>
      </main>
    </div>`,
    styles: css`
      .nc {
        min-height: 620px;
        background: #171717;
        color: #ddd7ca;
        font:
          13px/1.45 ui-monospace,
          SFMono-Regular,
          monospace;
      }
      .nc header {
        display: flex;
        gap: 20px;
        padding: 16px 22px;
        border-bottom: 1px solid #3c3932;
      }
      .nc header b {
        letter-spacing: 0.12em;
      }
      .nc header span,
      .nc section > span,
      .nc aside > span {
        color: #8ed2bb;
        font-size: 10px;
        letter-spacing: 0.1em;
      }
      .nc header small {
        margin-left: auto;
        color: #aaa396;
      }
      .nc main {
        display: grid;
        grid-template-columns: 1fr 245px;
        min-height: 568px;
      }
      .nc section {
        padding: 42px;
      }
      .nc h1 {
        margin: 9px 0;
        color: #f0eadf;
        font: 500 26px/1.2 system-ui;
      }
      .nc p {
        max-width: 600px;
        color: #aaa396;
        font: 15px/1.6 system-ui;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 34px;
      }
      .cards article {
        display: flex;
        flex-direction: column;
        min-height: 190px;
        padding: 17px;
        border: 1px solid #454039;
        background: #211f1b;
      }
      .cards .new {
        border-color: #8ed2bb;
        background: #222b25;
      }
      .cards b {
        color: #eee8dc;
        font: 500 17px system-ui;
      }
      .cards small {
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
      footer button + button {
        background: #8ed2bb;
        color: #17211b;
      }
      .nc aside {
        padding: 28px 18px;
        border-left: 1px solid #3c3932;
        background: #1d211d;
      }
      .nc aside b {
        display: block;
        margin-top: 18px;
      }
      .nc aside .open {
        color: #f1d18a;
      }
      .nc aside p {
        font-size: 12px;
      }
    `,
  });
};
