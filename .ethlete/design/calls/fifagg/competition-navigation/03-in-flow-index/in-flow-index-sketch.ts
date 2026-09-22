import { STAGES, STATIC_ITEMS } from '../01-entry/fixture';

export type InFlowIndexVariant = 'card' | 'split';

import { css, drawing, html } from '@design-explore';

export const inFlowIndexSketch = ({ variant }: { variant: InFlowIndexVariant }) =>
  drawing({
    body: html`
      <main class="index${variant === 'split' && 'index--split'}">
        <section class="desktop frame">
          <header><b>FIFAe</b><span>GAMING</span><span>ESPORTS</span><i>⌕ Search</i></header>
          <div class="hero">FIFAe World Cup 2026™ ft. eFootball Mobile</div>
          <ng-container [ngTemplateOutlet]="desktopIndex" /><ng-container [ngTemplateOutlet]="content" />
        </section>
        <section class="mobile frame">
          <header><b>FIFAe</b><span>☰</span></header>
          <div class="mobile-hero">FIFAe World Cup 2026™<br />ft. eFootball Mobile</div>
          <ng-container [ngTemplateOutlet]="mobileIndex" /><ng-container [ngTemplateOutlet]="content" />
        </section>
      </main>
      <ng-template #desktopIndex>
        ${
          variant === 'card'
            ? html`
                <nav class="index-card">
                  <div class="index-title"><b>Competition index</b><span>9 destinations</span></div>
                  <div class="index-columns">
                    <section>
                      <small>PAGES</small>
                      <div class="links">
                        ${STATIC_ITEMS.map(
                          (item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `,
                        )}
                      </div>
                    </section>
                    <section>
                      <small>STAGES</small>
                      <div class="links stages">
                        ${STAGES.map(
                          (stage) => html`
                            <span class="${stage.name === 'Continental championship' && 'live'}"
                              ><i></i>${stage.name}</span
                            >
                          `,
                        )}
                      </div>
                    </section>
                  </div>
                </nav>
              `
            : html`
                <nav class="split-index">
                  <div class="page-links">
                    ${STATIC_ITEMS.map(
                      (item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `,
                    )}
                  </div>
                  <div class="stage-strip">
                    <small>STAGES</small>
                    ${STAGES.map(
                      (stage) => html`
                        <span class="${stage.name === 'Continental championship' && 'live'}"><i></i>${stage.name}</span>
                      `,
                    )}
                  </div>
                </nav>
              `
        }
      </ng-template>
      <ng-template #mobileIndex>
        ${
          variant === 'card'
            ? html`
                <nav class="mobile-card">
                  <div class="summary">
                    <span><small>COMPETITION INDEX</small>Continental championship</span><b>⌄</b>
                  </div>
                  <div class="mobile-links">
                    <small>PAGES</small>
                    <div class="links">
                      ${STATIC_ITEMS.map(
                        (item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `,
                      )}
                    </div>
                    <small>STAGES</small>
                    <div class="links stages">
                      ${STAGES.map(
                        (stage) => html`
                          <span class="${stage.name === 'Continental championship' && 'live'}"
                            ><i></i>${stage.name}</span
                          >
                        `,
                      )}
                    </div>
                  </div>
                </nav>
              `
            : html`
                <nav class="mobile-split">
                  <div class="page-links">
                    ${STATIC_ITEMS.map(
                      (item) => html` <span class="${item === 'Overview' && 'selected'}">${item}</span> `,
                    )}
                  </div>
                  <div class="summary">
                    <span><small>STAGES · 4</small>Continental championship</span><b>⌄</b>
                  </div>
                  <div class="stage-list">
                    ${STAGES.map(
                      (stage) => html`
                        <span class="${stage.name === 'Continental championship' && 'live'}"
                          ><i></i>${stage.name}<small>${stage.detail}</small></span
                        >
                      `,
                    )}
                  </div>
                </nav>
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
      .index {
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
      .frame {
        overflow: hidden;
        border: 1px solid #293442;
        border-radius: 13px;
        background: #111923;
        box-shadow: 0 18px 40px #0005;
      }
      .frame header {
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
      .frame header b {
        color: #fff;
        font-size: 20px;
        letter-spacing: -1px;
      }
      .frame header i {
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
      .index-card,
      .split-index {
        margin: 16px 20px;
        padding: 14px;
        border: 1px solid #2c3b4d;
        border-radius: 9px;
        background: #172230;
      }
      .index-title,
      .summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .index-title span {
        color: #8d99a9;
        font-size: 10px;
      }
      .index-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 12px;
      }
      .index-columns section + section {
        padding-left: 14px;
        border-left: 1px solid #304052;
      }
      .index small,
      .links + small {
        display: block;
        margin: 0 0 7px;
        color: #8390a1;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.09em;
      }
      .links,
      .page-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .links span,
      .page-links span,
      .stage-strip span {
        padding: 7px 9px;
        border-radius: 5px;
        background: #202d3c;
        color: #c4cbd5;
        font-size: 10px;
        font-weight: 700;
      }
      .links .selected,
      .page-links .selected {
        background: #f5d91a;
        color: #182231;
      }
      .links .live,
      .stage-strip .live {
        color: #f5d91a;
      }
      .links i,
      .stage-strip i,
      .stage-list i {
        display: inline-block;
        width: 6px;
        height: 6px;
        margin-right: 5px;
        border: 2px solid #738198;
        border-radius: 50%;
      }
      .links .live i,
      .stage-strip .live i,
      .stage-list .live i {
        border-color: #f5d91a;
        background: #f5d91a;
        box-shadow: 0 0 0 2px #f5d91a33;
      }
      .split-index {
        display: grid;
        gap: 11px;
      }
      .stage-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        padding-top: 11px;
        border-top: 1px solid #2e3d4e;
      }
      .stage-strip small {
        margin: 0 4px 0 0;
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
      .mobile {
        min-height: 590px;
      }
      .mobile header {
        height: 42px;
        padding: 0 14px;
      }
      .mobile header span {
        margin-left: auto;
      }
      .mobile-hero {
        height: 110px;
        padding: 14px;
        font-size: 17px;
      }
      .mobile-card,
      .mobile-split {
        margin: 12px 14px;
        border: 1px solid #2c3b4d;
        border-radius: 8px;
        background: #172230;
      }
      .summary {
        padding: 11px;
      }
      .summary span {
        display: grid;
        font-size: 12px;
        font-weight: 800;
      }
      .summary small {
        margin: 0;
        color: #f5d91a;
        font-size: 8px;
      }
      .summary b {
        color: #f5d91a;
        font-size: 16px;
      }
      .mobile-links,
      .stage-list {
        padding: 0 11px 11px;
      }
      .mobile-links > small {
        margin-top: 10px;
      }
      .mobile-links .links {
        margin-bottom: 8px;
      }
      .mobile-split .page-links {
        padding: 11px;
        border-bottom: 1px solid #2e3d4e;
      }
      .stage-list {
        display: grid;
        gap: 5px;
      }
      .stage-list > span {
        padding: 8px;
        border-radius: 6px;
        background: #202d3c;
        font-size: 11px;
        font-weight: 700;
      }
      .stage-list small {
        display: block;
        margin: 3px 0 0 14px;
        color: #8d99a9;
        font-size: 9px;
        font-weight: 400;
      }
      .stage-list .live {
        background: #26313a;
        color: #f5d91a;
      }
    `,
  });
