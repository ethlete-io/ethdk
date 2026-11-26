export type ReviewHome = 'queue' | 'atlas' | 'journal';

import { css, drawing, html } from '@design-explore';

export const reviewHome = ({ home }: { home: ReviewHome }) => {
  const LABELS = ['A · Hairline', 'B · Docked workbench', 'C · Soft band'];

  return drawing({
    body: html`
      <div class="review${home === 'atlas' && 'review--atlas'}${home === 'journal' && 'review--journal'}">
        <header><b>DESIGN REVIEW</b><span>Timetrack / Kerbe</span><small>⌘ K search</small></header>
        ${
          home === 'queue'
            ? html`
                <div class="queue-layout">
                  <aside>
                    <span>DECISIONS · 3 OPEN</span><b>01 / Separator</b><b class="active">02 / Compare home</b
                    ><b>03 / Narrow lane</b><em>↑ ↓ move · enter decide</em>
                  </aside>
                  <main>
                    <span>02 / COMPARE HOME</span>
                    <h1>Does B beat the current winner?</h1>
                    <div class="compare"><i></i></div>
                    <footer><button>← Keep A</button><button class="choose">Choose B →</button></footer>
                  </main>
                  <aside class="decision">
                    <span>DECISION</span><b>B · Docked workbench</b>
                    <p>1 click compares a candidate with its winner.</p>
                    <button>Record decision</button>
                  </aside>
                </div>
              `
            : home === 'atlas'
              ? html`
                  <main class="atlas">
                    <div>
                      <span>ALL WORK · 18 OPTIONS</span>
                      <h1>Find what needs a decision.</h1>
                    </div>
                    <section>
                      ${LABELS.map(
                        (label, index) => html`
                          <article class="${label === 'B · Docked workbench' && 'selected'}">
                            <div></div>
                            <b>${label}</b><small>round ${index + 1}</small>
                          </article>
                        `,
                      )}
                    </section>
                    <aside><span>COMPARE · 2</span><b>A ↔ B</b><button>Open comparison</button></aside>
                  </main>
                `
              : html`
                  <main class="journal">
                    <div>
                      <span>DECISION JOURNAL</span>
                      <h1>The reasoning, in order.</h1>
                    </div>
                    <section>
                      <article>
                        <span>SETTLED · 3 MIN AGO</span><b>Compare activation</b>
                        <p>B won: one click compares the candidate to the current winner.</p>
                      </article>
                      <article>
                        <span>OPEN</span><b>Compare home</b>
                        <p>Three layouts waiting for a decision.</p>
                      </article>
                      <article>
                        <span>SETTLED · YESTERDAY</span><b>Separator</b>
                        <p>A hairline held the lanes together without adding visual weight.</p>
                      </article>
                    </section>
                  </main>
                `
        }
      </div>
    `,
    styles: css`
      .review {
        min-height: 650px;
        background: #171717;
        color: #ddd7ca;
        font:
          13px/1.4 ui-monospace,
          SFMono-Regular,
          monospace;
      }
      .review header {
        display: flex;
        gap: 22px;
        padding: 16px 22px;
        border-bottom: 1px solid #3c3932;
      }
      .review header b {
        letter-spacing: 0.12em;
      }
      .review header span {
        color: #aaa396;
      }
      .review header small {
        margin-left: auto;
        color: #8ed2bb;
      }
      .queue-layout {
        display: grid;
        grid-template-columns: 210px 1fr 220px;
        min-height: 598px;
      }
      .queue-layout aside {
        display: flex;
        flex-direction: column;
        gap: 11px;
        padding: 24px 15px;
        border-right: 1px solid #3c3932;
      }
      .queue-layout aside span,
      main > span,
      .atlas > div span,
      .journal > div span,
      .journal article span {
        color: #8ed2bb;
        font-size: 10px;
        letter-spacing: 0.1em;
      }
      .queue-layout aside b {
        padding: 9px;
        color: #b5afa2;
      }
      .queue-layout aside .active {
        border-left: 2px solid #8ed2bb;
        background: #24241f;
        color: #f1eadc;
      }
      .queue-layout aside em {
        margin-top: auto;
        color: #857f73;
        font-size: 11px;
        font-style: normal;
      }
      .queue-layout main {
        padding: 35px;
      }
      h1 {
        margin: 9px 0 22px;
        color: #f0eadf;
        font: 500 24px/1.2 system-ui;
      }
      .compare {
        position: relative;
        height: 370px;
        overflow: hidden;
        border: 1px solid #625e54;
        background:
          repeating-linear-gradient(to bottom, transparent 0 43px, #4b473f 44px),
          linear-gradient(90deg, #26251f 0 28%, #4d493f 28% 29%, #26251f 29% 62%, #171717 62% 65%, #26251f 65%);
        box-shadow:
          inset 0 85px #635849,
          inset 0 -145px #3d5047;
      }
      .compare i {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 54%;
        border-left: 2px solid #8ed2bb;
      }
      button {
        padding: 8px 11px;
        border: 1px solid #5e7769;
        background: #222c25;
        color: #abe0cc;
        font: inherit;
      }
      footer {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
      }
      .choose {
        background: #8ed2bb;
        color: #17211b;
      }
      .decision {
        border-right: 0 !important;
        background: #1d241e;
      }
      .decision b {
        color: #f1eadc;
        font: 500 17px system-ui;
      }
      .decision p {
        color: #aba497;
      }
      .atlas,
      .journal {
        padding: 34px 42px;
      }
      .atlas section {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-top: 25px;
      }
      .atlas article {
        padding: 9px;
        border: 1px solid #403c35;
        background: #211f1b;
      }
      .atlas article.selected {
        border-color: #8ed2bb;
      }
      .atlas article div {
        height: 110px;
        background: linear-gradient(135deg, #625748 0 25%, #292720 25% 60%, #3d5047 60%);
      }
      .atlas article b,
      .atlas article small {
        display: block;
        margin-top: 7px;
      }
      .atlas article small {
        color: #989184;
      }
      .atlas aside {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-top: 20px;
        padding: 13px;
        border: 1px solid #557062;
        background: #1e251f;
      }
      .atlas aside b {
        font: 500 17px system-ui;
      }
      .atlas aside button {
        margin-left: auto;
      }
      .journal section {
        max-width: 660px;
        border-left: 1px solid #5c7668;
      }
      .journal article {
        margin-left: 22px;
        padding: 0 0 28px;
      }
      .journal article b {
        display: block;
        margin-top: 7px;
        color: #f0eadf;
        font: 500 18px system-ui;
      }
      .journal article p {
        color: #aaa396;
      }
    `,
  });
};
