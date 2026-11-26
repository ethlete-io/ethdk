export type CompareEntry = 'hover' | 'winner' | 'pick';

import { css, drawing, html } from '@design-explore';

export const compareEntry = ({ entry }: { entry: CompareEntry }) => {
  const count = entry === 'pick' ? 2 : 1;
  const button = (key: string) => (entry === 'pick' ? `Compare ${key}` : 'Open comparison');
  const state = (key: string) => (key === 'a' || entry === 'winner' ? 'CURRENT WINNER' : 'CANDIDATE');
  const note = entry === 'hover' ? 'Hover to preview' : 'Choose two options to compare';

  return drawing({
    body: html`
      <div class="entry${entry === 'hover' && 'entry--hover'}">
        <header><span>ROUND 2 · OPEN</span><b>Separator treatments</b><small>${count}</small></header>
        <div class="entry-body">
          <section class="cards">
            <article class="card card--base">
              <div class="mini mini--a"></div>
              <b>A · Hairline</b><small>current winner</small><button>${button('a')}</button>
            </article>
            <article class="card card--active">
              <div class="mini mini--b"></div>
              <b>B · Gutter gap</b><small>${state('b')}</small><button>${button('b')}</button>
            </article>
            <article class="card">
              <div class="mini mini--c"></div>
              <b>C · Soft band</b><small>${state('c')}</small><button>${button('c')}</button>
            </article>
          </section>
          <section class="instant${entry === 'pick' && 'instant--off'}">
            <div class="instant-head"><span>COMPARE</span><b>A · Hairline ↔ B · Gutter gap</b></div>
            <div class="pair">
              <div class="pair-a"></div>
              <div class="pair-b"></div>
              <i></i>
            </div>
            <p>${note}</p>
          </section>
        </div>
      </div>
    `,
    styles: css`
      .entry {
        min-height: 620px;
        padding: 28px;
        background: #171717;
        color: #ded8cc;
        font:
          13px/1.4 ui-monospace,
          SFMono-Regular,
          Menlo,
          monospace;
      }
      .entry header {
        display: flex;
        gap: 17px;
        align-items: center;
        padding-bottom: 22px;
        border-bottom: 1px solid #403c35;
      }
      .entry header span,
      .instant-head span {
        color: #8ed2bb;
        font-size: 11px;
        letter-spacing: 0.1em;
      }
      .entry header b {
        color: #eee8dc;
        font: 500 18px system-ui;
      }
      .entry header small {
        margin-left: auto;
        color: #aaa396;
      }
      .entry-body {
        display: grid;
        grid-template-columns: 44% 1fr;
        gap: 20px;
        padding-top: 24px;
      }
      .cards {
        display: grid;
        gap: 10px;
      }
      .card {
        display: grid;
        grid-template-columns: 88px 1fr auto;
        column-gap: 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid #403c35;
        background: #211f1b;
      }
      .card--base {
        border-color: #708d7e;
      }
      .card--active {
        border-color: #8ed2bb;
        background: #222b25;
      }
      .mini {
        grid-row: span 3;
        height: 76px;
        background:
          repeating-linear-gradient(to bottom, transparent 0 18px, #504b42 19px),
          linear-gradient(90deg, #292720 0 48%, #4c493f 48% 51%, #292720 51%);
      }
      .mini--a {
        box-shadow: inset 0 23px #625748;
      }
      .mini--b {
        background:
          repeating-linear-gradient(to bottom, transparent 0 18px, #504b42 19px),
          linear-gradient(90deg, #292720 0 46%, #171717 46% 52%, #292720 52%);
        box-shadow: inset 0 23px #625748;
      }
      .mini--c {
        box-shadow:
          inset 0 23px #625748,
          inset 0 -21px #556258;
      }
      .card b {
        color: #eee8dc;
      }
      .card small {
        color: #a9a296;
      }
      .card button {
        grid-row: span 3;
        padding: 7px 9px;
        border: 1px solid #6e887b;
        background: #27352d;
        color: #a9ddc9;
        font: inherit;
      }
      .instant {
        padding: 16px;
        border: 1px solid #587061;
        background: #1e251f;
      }
      .instant--off {
        opacity: 0.38;
      }
      .instant-head {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .instant-head b {
        color: #eee8dc;
        font: 500 17px system-ui;
      }
      .pair {
        position: relative;
        height: 330px;
        margin-top: 18px;
        overflow: hidden;
        border: 1px solid #625e54;
      }
      .pair-a,
      .pair-b {
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(to bottom, transparent 0 42px, #4b473f 43px),
          linear-gradient(90deg, #26251f 0 28%, #4d493f 28% 29%, #26251f 29% 62%, #4d493f 62% 63%, #26251f 63%);
        box-shadow:
          inset 0 78px #635849,
          inset 0 -120px #3d5047;
      }
      .pair-b {
        clip-path: inset(0 0 0 52%);
        background:
          repeating-linear-gradient(to bottom, transparent 0 42px, #4b473f 43px),
          linear-gradient(90deg, #26251f 0 27%, #171717 27% 30%, #26251f 30% 61%, #171717 61% 64%, #26251f 64%);
      }
      .pair i {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 52%;
        border-left: 2px solid #8ed2bb;
      }
      .instant p {
        color: #aaa397;
        font-size: 11px;
      }
    `,
  });
};
