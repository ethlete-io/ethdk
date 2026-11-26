export type CompareHome = 'dock' | 'overlay' | 'page';

import { css, drawing, html } from '@design-explore';

export const compareHome = ({ home }: { home: CompareHome }) =>
  drawing({
    body: html`
      <div class="tool${home === 'page' && 'tool--page'}">
        <aside class="tree">
          <strong>DESIGN</strong>
          <span class="tree-section">TIMELINE</span>
          <span class="tree-item">00 treatment</span>
          <span class="tree-item tree-item--active">01 separators</span>
          <span class="tree-item">02 short bands</span>
          <span class="tree-section">OPEN</span>
          <span class="tree-item">Compare home</span>
        </aside>
        <main class="call${home === 'page' && 'call--muted'}">
          <header class="call-head">
            <span>ROUND 1 · OPEN</span>
            <h1>Which separator makes the day easier to scan?</h1>
            <p>Three treatments at the same timeline geometry.</p>
          </header>
          <div class="options">
            <article class="option option--picked">
              <div class="timeline timeline--a"></div>
              <b>A · Hairline</b><small>chosen for compare</small>
            </article>
            <article class="option option--picked">
              <div class="timeline timeline--b"></div>
              <b>B · Gutter gap</b><small>chosen for compare</small>
            </article>
            <article class="option">
              <div class="timeline timeline--c"></div>
              <b>C · Soft band</b>
            </article>
          </div>
        </main>
        ${
          home === 'dock' &&
          html`
            <aside class="bench">
              <div class="bench-head"><span>COMPARE · 2</span><button>Clear</button></div>
              <h2>A · Hairline<br />B · Gutter gap</h2>
              <div class="comparison">
                <div class="comparison-a"></div>
                <div class="comparison-b"></div>
                <i></i>
              </div>
              <p>← → wipe · space blink</p>
              <a>Open full comparison</a>
            </aside>
          `
        }
        ${
          home === 'overlay' &&
          html`
            <section class="overlay">
              <div><span>COMPARE · 2</span><button>Clear</button></div>
              <h2>A · Hairline &nbsp; / &nbsp; B · Gutter gap</h2>
              <div class="comparison">
                <div class="comparison-a"></div>
                <div class="comparison-b"></div>
                <i></i>
              </div>
            </section>
          `
        }
        ${
          home === 'page' &&
          html`
            <section class="compare-page">
              <header><a>← Round 1 · separators</a><span>COMPARE · 2</span></header>
              <h1>A · Hairline <em>↔</em> B · Gutter gap</h1>
              <div class="comparison">
                <div class="comparison-a"></div>
                <div class="comparison-b"></div>
                <i></i>
              </div>
              <p>Use ← → to move the seam · space to blink</p>
            </section>
          `
        }
      </div>
    `,
    styles: css`
      .tool {
        position: relative;
        display: grid;
        min-height: 650px;
        grid-template-columns: 190px minmax(0, 1fr);
        overflow: hidden;
        background: #171717;
        color: #ddd8cd;
        font:
          13px/1.4 ui-monospace,
          SFMono-Regular,
          Menlo,
          monospace;
      }
      .tree {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 22px 14px;
        border-right: 1px solid #37342e;
        background: #111;
      }
      .tree strong {
        color: #d6d0c2;
        letter-spacing: 0.14em;
      }
      .tree-section {
        margin-top: 16px;
        color: #807b70;
        font-size: 10px;
        letter-spacing: 0.12em;
      }
      .tree-item {
        padding: 7px 8px;
        color: #aaa498;
      }
      .tree-item--active {
        border-left: 2px solid #8ed2bb;
        background: #24231f;
        color: #f2ece0;
      }
      .call {
        padding: 40px;
      }
      .call--muted {
        opacity: 0.2;
      }
      .call-head > span,
      .bench-head span,
      .overlay span,
      .compare-page header span {
        color: #8ed2bb;
        font-size: 11px;
        letter-spacing: 0.1em;
      }
      h1,
      h2,
      p {
        margin: 0;
      }
      .call h1 {
        max-width: 590px;
        margin-top: 10px;
        color: #f0eadf;
        font: 500 27px/1.2 system-ui;
      }
      .call-head p {
        margin-top: 11px;
        color: #969084;
      }
      .options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin-top: 34px;
      }
      .option {
        padding: 12px;
        border: 1px solid #3d3932;
        background: #201f1b;
        color: #e8e2d7;
      }
      .option--picked {
        border-color: #8ed2bb;
      }
      .option b,
      .option small {
        display: block;
        margin-top: 10px;
      }
      .option small {
        color: #8ed2bb;
      }
      .timeline,
      .comparison-a,
      .comparison-b {
        background:
          repeating-linear-gradient(to bottom, transparent 0 29px, #4b473f 30px),
          linear-gradient(90deg, #26251f 0 28%, #4d493f 28% 29%, #26251f 29% 62%, #4d493f 62% 63%, #26251f 63%);
      }
      .timeline {
        height: 190px;
      }
      .timeline--a {
        box-shadow:
          inset 0 45px #635849,
          inset 0 -82px #3d5047;
      }
      .timeline--b {
        background:
          repeating-linear-gradient(to bottom, transparent 0 29px, #4b473f 30px),
          linear-gradient(90deg, #26251f 0 27%, #171717 27% 30%, #26251f 30% 61%, #171717 61% 64%, #26251f 64%);
        box-shadow:
          inset 0 45px #635849,
          inset 0 -82px #3d5047;
      }
      .timeline--c {
        box-shadow:
          inset 0 45px #635849,
          inset 0 -82px #5b685d;
      }
      .bench {
        z-index: 2;
        padding: 22px;
        border-left: 1px solid #4c665b;
        background: #1d211d;
      }
      .bench-head,
      .overlay > div,
      .compare-page header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      button,
      a {
        color: #8ed2bb;
        font: inherit;
      }
      button {
        border: 0;
        background: none;
        cursor: pointer;
      }
      .bench h2,
      .overlay h2 {
        margin: 14px 0 17px;
        color: #f2ece1;
        font: 500 17px/1.35 system-ui;
      }
      .comparison {
        position: relative;
        height: 300px;
        overflow: hidden;
        border: 1px solid #625e54;
      }
      .comparison-a,
      .comparison-b {
        position: absolute;
        inset: 0;
        box-shadow:
          inset 0 78px #635849,
          inset 0 -140px #3d5047;
      }
      .comparison-b {
        clip-path: inset(0 0 0 53%);
        background:
          repeating-linear-gradient(to bottom, transparent 0 43px, #4b473f 44px),
          linear-gradient(90deg, #26251f 0 27%, #171717 27% 30%, #26251f 30% 61%, #171717 61% 64%, #26251f 64%);
      }
      .comparison i {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 53%;
        border-left: 2px solid #8ed2bb;
      }
      .bench p,
      .compare-page p {
        margin: 13px 0;
        color: #a39d90;
        font-size: 11px;
      }
      .overlay {
        position: absolute;
        z-index: 3;
        top: 25px;
        right: 30px;
        left: 220px;
        padding: 22px;
        border: 1px solid #708d7e;
        background: #202620;
        box-shadow: 0 22px 50px #0009;
      }
      .overlay .comparison {
        height: 265px;
      }
      .compare-page {
        position: absolute;
        inset: 0;
        z-index: 3;
        padding: 28px 45px;
        background: #171717;
      }
      .compare-page h1 {
        margin: 60px 0 25px;
        color: #f0eadf;
        font: 500 25px system-ui;
      }
      .compare-page h1 em {
        color: #8ed2bb;
        font-style: normal;
      }
      .compare-page .comparison {
        height: 390px;
        max-width: 690px;
      }
    `,
  });
