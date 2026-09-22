import { STAGES, STATIC_ITEMS } from '../01-entry/fixture';

export type StageContextVariant = 'pager' | 'cards';

import { css, drawing, html } from '@design-explore';

export const stageContextSketch = ({ variant }: { variant: StageContextVariant }) =>
  drawing({
    body: html`
      <main class="context${variant === 'cards' && 'context--cards'}">
        <section class="wide ctx-frame">
          <header><b>FIFAe</b><span>GAMING</span><span>ESPORTS</span><i>⌕ Search</i></header>
          <div class="hero">FIFAe World Cup 2026™ ft. eFootball Mobile</div>
          <nav class="pages">
            ${STATIC_ITEMS.map((item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `)}
          </nav>
          <ng-container [ngTemplateOutlet]="wideStages" /><ng-container [ngTemplateOutlet]="content" />
        </section>
        <section class="narrow ctx-frame">
          <header><b>FIFAe</b><span>☰</span></header>
          <div class="mobile-hero">FIFAe World Cup 2026™<br />ft. eFootball Mobile</div>
          <nav class="pages">
            ${STATIC_ITEMS.slice(0, 3).map(
              (item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `,
            )}
          </nav>
          <ng-container [ngTemplateOutlet]="mobileStages" /><ng-container [ngTemplateOutlet]="content" />
        </section>
      </main>
      <ng-template #wideStages>
        ${
          variant === 'pager'
            ? html`
                <section class="stage-pager">
                  <button>‹</button>
                  <div><small>STAGE 3 OF 4 · LIVE NOW</small><b>Continental championship</b></div>
                  <button>›</button>
                </section>
                <div class="stage-list">
                  ${STAGES.map(
                    (stage) => html`
                      <span class="${stage.name === 'Continental championship' && 'live'}"><i></i>${stage.name}</span>
                    `,
                  )}
                </div>
              `
            : html`
                <section class="stage-cards">
                  ${STAGES.map(
                    (stage) => html`
                      <div class="${stage.name === 'Continental championship' && 'live'}">
                        <small>${stage.detail}</small><b>${stage.name}</b>
                      </div>
                    `,
                  )}
                </section>
              `
        }
      </ng-template>
      <ng-template #mobileStages>
        ${
          variant === 'pager'
            ? html`
                <section class="stage-pager">
                  <button>‹</button>
                  <div><small>STAGE 3 OF 4 · LIVE NOW</small><b>Continental championship</b></div>
                  <button>›</button>
                </section>
              `
            : html`
                <section class="stage-cards">
                  <div><small>Completed</small><b>Regional online qualifiers</b></div>
                  <div class="live"><small>LIVE NOW</small><b>Continental championship</b></div>
                </section>
              `
        }
      </ng-template>
      <ng-template #content
        ><article>
          <b>Matchups</b><span>More Matchups</span>
          <div></div>
          <b>Standings</b>
        </article></ng-template
      >
    `,
    styles: css`
      .context {
        display: grid;
        grid-template-columns: 1fr 260px;
        gap: 28px;
        min-height: 650px;
        padding: 26px;
        background: #0d131b;
        color: #eef2f7;
        font:
          13px/1.3 Inter,
          Arial,
          sans-serif;
      }
      .ctx-frame {
        overflow: hidden;
        border: 1px solid #293442;
        border-radius: 13px;
        background: #111923;
        box-shadow: 0 18px 40px #0005;
      }
      .ctx-frame header {
        display: flex;
        align-items: center;
        gap: 25px;
        height: 48px;
        padding: 0 20px;
        background: #182330;
        color: #bbc4d1;
        font-size: 11px;
        font-weight: 700;
      }
      .ctx-frame header b {
        color: #fff;
        font-size: 20px;
        letter-spacing: -1px;
      }
      .ctx-frame header i {
        margin-left: auto;
        padding: 8px 48px 8px 12px;
        border: 1px solid #2c3b4d;
        border-radius: 7px;
        color: #748095;
        font-style: normal;
        font-weight: 400;
      }
      .hero,
      .mobile-hero {
        display: flex;
        align-items: end;
        padding: 20px;
        background: linear-gradient(118deg, #321c69, #12425b 54%, #e8891d);
        font-size: 28px;
        font-weight: 800;
        line-height: 1.05;
      }
      .hero {
        height: 145px;
      }
      .pages {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        padding: 12px 20px;
        border-bottom: 1px solid #2c3b4d;
      }
      .pages span {
        color: #b7c0cd;
        font-size: 11px;
        font-weight: 700;
      }
      .pages .selected {
        color: #f5d91a;
      }
      .stage-pager {
        display: grid;
        grid-template-columns: 38px 1fr 38px;
        align-items: center;
        margin: 14px 20px 8px;
        border: 1px solid #354659;
        border-radius: 8px;
        background: #182536;
      }
      .stage-pager button {
        height: 45px;
        border: 0;
        background: #202f40;
        color: #f5d91a;
        font-size: 23px;
      }
      .stage-pager div {
        display: grid;
        padding: 5px 12px;
      }
      .stage-pager small {
        color: #f5d91a;
        font-size: 8px;
        font-weight: 800;
      }
      .stage-pager b {
        font-size: 14px;
      }
      .stage-list {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin: 0 20px 14px;
      }
      .stage-list span {
        padding: 6px 8px;
        border-radius: 5px;
        background: #202d3c;
        color: #aeb9c8;
        font-size: 10px;
        font-weight: 700;
      }
      .stage-list i {
        display: inline-block;
        width: 6px;
        height: 6px;
        margin-right: 5px;
        border: 2px solid #718096;
        border-radius: 50%;
      }
      .stage-list .live {
        color: #f5d91a;
      }
      .stage-list .live i {
        border-color: #f5d91a;
        background: #f5d91a;
      }
      .stage-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
        margin: 14px 20px;
      }
      .stage-cards div {
        display: grid;
        gap: 7px;
        min-height: 58px;
        padding: 9px;
        border: 1px solid #304052;
        border-radius: 7px;
        background: #1a2735;
      }
      .stage-cards small {
        color: #8996a8;
        font-size: 9px;
      }
      .stage-cards b {
        font-size: 10px;
        line-height: 1.1;
      }
      .stage-cards .live {
        border-color: #f5d91a;
        background: #27313a;
      }
      .stage-cards .live b,
      .stage-cards .live small {
        color: #f5d91a;
      }
      article {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 13px;
        margin: 20px;
      }
      article b {
        font-size: 17px;
      }
      article span {
        color: #f5d91a;
        font-size: 10px;
        font-weight: 700;
      }
      article div {
        grid-column: 1/-1;
        height: 64px;
        border-radius: 8px;
        background: linear-gradient(90deg, #1d2a39 30%, #202d3c 30% 31%, #1d2a39 31% 64%, #202d3c 64% 65%, #1d2a39 65%);
      }
      .narrow {
        min-height: 590px;
      }
      .narrow header {
        height: 42px;
        padding: 0 14px;
      }
      .narrow header span {
        margin-left: auto;
      }
      .mobile-hero {
        height: 110px;
        padding: 14px;
        font-size: 17px;
      }
      .narrow .pages {
        gap: 11px;
        padding: 11px 14px;
      }
      .narrow .stage-pager {
        margin: 12px 14px;
      }
      .narrow .stage-cards {
        grid-template-columns: 1fr 1fr;
        margin: 12px 14px;
      }
      .narrow .stage-cards div {
        min-height: 62px;
      }
      .context--cards .wide article {
        margin-top: 17px;
      }
    `,
  });
