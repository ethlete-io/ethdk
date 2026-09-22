import { STAGES, STATIC_ITEMS } from '../01-entry/fixture';

export type HeaderContextVariant = 'chip' | 'mode';

import { css, drawing, html } from '@design-explore';

export const headerContextSketch = ({ variant }: { variant: HeaderContextVariant }) => {
  const mobile = false;

  return drawing({
    body: html`
      <main class="header-context${variant === 'mode' && 'header-context--mode'}">
        <section class="header-context__desktop header-context__frame">
          <ng-container *ngTemplateOutlet="header; context: { mobile: false }" />
          <ng-container *ngTemplateOutlet="localMap; context: { mobile: false }" />
          <ng-container *ngTemplateOutlet="content" />
        </section>
        <section class="header-context__mobile header-context__frame">
          <ng-container *ngTemplateOutlet="header; context: { mobile: true }" />
          <ng-container *ngTemplateOutlet="localMap; context: { mobile: true }" />
          <ng-container *ngTemplateOutlet="content" />
        </section>
      </main>
      <ng-template #header let-mobile="mobile">
        <header class="header-context__topbar">
          <b>FIFAe</b>
          ${!mobile && html` <span>GAMING</span><span>ESPORTS</span> `}
          ${
            variant === 'chip'
              ? html`
                  <button class="header-context__competition">
                    <small>COMPETITION</small><strong>${mobile ? 'WORLD CUP 26' : 'FIFAe World Cup 2026™'}</strong
                    ><i>⌄</i>
                  </button>
                `
              : !mobile
                ? html` <span class="header-context__section">COMPETITIONS</span> `
                : ''
          }
          <i class="header-context__search">${mobile ? '☰' : '⌕ Search'}</i>
        </header>
        ${
          variant === 'mode' &&
          html`
            <nav class="header-context__modebar">
              <b>${mobile ? 'FIFAe World Cup 2026™' : 'FIFAe World Cup 2026™ ft. eFootball Mobile'}</b
              ><span>Competition map ⌄</span>
            </nav>
          `
        }
      </ng-template>
      <ng-template #localMap let-mobile="mobile">
        ${
          variant === 'chip'
            ? html`
                <aside class="header-context__popover${mobile && 'header-context__popover--mobile'}">
                  <div class="header-context__map-head">
                    <small>CURRENT COMPETITION</small><b>FIFAe World Cup 2026™<br />ft. eFootball Mobile</b>
                  </div>
                  <div class="header-context__map-grid">
                    <section>
                      <small>PAGES</small>
                      ${STATIC_ITEMS.map(
                        (item) => html`
                          <span class="${item === 'Overview' && 'header-context__selected'}">${item}</span>
                        `,
                      )}
                    </section>
                    <section>
                      <small>STAGES</small>
                      ${STAGES.map(
                        (stage) => html`
                          <span class="${stage.name === 'Continental championship' && 'header-context__live'}"
                            ><i></i>${stage.name}</span
                          >
                        `,
                      )}
                    </section>
                  </div>
                </aside>
              `
            : html`
                <nav class="header-context__localbar${mobile && 'header-context__localbar--mobile'}">
                  <div>
                    <small>PAGES</small>
                    ${STATIC_ITEMS.map(
                      (item) => html`
                        <span class="${item === 'Overview' && 'header-context__selected'}">${item}</span>
                      `,
                    )}
                  </div>
                  <div>
                    <small>STAGES</small>
                    ${STAGES.map(
                      (stage) => html`
                        <span class="${stage.name === 'Continental championship' && 'header-context__live'}"
                          ><i></i>${stage.name}</span
                        >
                      `,
                    )}
                  </div>
                </nav>
              `
        }
      </ng-template>
      <ng-template #content>
        <article class="header-context__content">
          <div class="header-context__hero">FIFAe World Cup 2026™<br />ft. eFootball Mobile</div>
          <section>
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </section>
        </article>
      </ng-template>
    `,
    styles: css`
      .header-context {
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
      .header-context__frame {
        position: relative;
        overflow: hidden;
        border: 1px solid #293442;
        border-radius: 13px;
        background: #111923;
        box-shadow: 0 18px 40px #0005;
      }
      .header-context__topbar {
        display: flex;
        align-items: center;
        gap: 24px;
        height: 55px;
        padding: 0 20px;
        background: #182330;
        color: #bbc4d1;
        font-size: 11px;
        font-weight: 800;
      }
      .header-context__topbar > b {
        color: #fff;
        font-size: 23px;
        letter-spacing: -1px;
      }
      .header-context__search {
        margin-left: auto;
        padding: 8px 46px 8px 12px;
        border: 1px solid #2c3b4d;
        border-radius: 7px;
        color: #8491a3;
        font-style: normal;
        font-weight: 400;
      }
      .header-context__competition {
        display: grid;
        grid-template-columns: 1fr auto;
        min-width: 246px;
        margin-left: 4px;
        padding: 7px 10px;
        border: 0;
        border-bottom: 2px solid #1687ff;
        background: #223246;
        color: #fff;
        text-align: left;
        font: inherit;
      }
      .header-context__competition small {
        color: #1687ff;
        font-size: 8px;
        letter-spacing: 0.09em;
      }
      .header-context__competition strong {
        font-size: 12px;
      }
      .header-context__competition i {
        grid-column: 2;
        grid-row: 2;
        color: #1687ff;
        font-size: 16px;
        font-style: normal;
      }
      .header-context__section {
        color: #1687ff;
      }
      .header-context__modebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 45px;
        padding: 0 20px;
        border-bottom: 1px solid #314154;
        background: #1d2b3b;
      }
      .header-context__modebar b {
        font-size: 13px;
      }
      .header-context__modebar span {
        color: #1687ff;
        font-size: 10px;
        font-weight: 800;
      }
      .header-context__popover {
        position: absolute;
        z-index: 2;
        top: 55px;
        left: 150px;
        width: 400px;
        border: 1px solid #33465a;
        border-top: 2px solid #1687ff;
        border-radius: 0 0 10px 10px;
        background: #172230;
        box-shadow: 0 20px 40px #0009;
      }
      .header-context__map-head {
        display: grid;
        gap: 5px;
        padding: 15px;
        border-bottom: 1px solid #314154;
      }
      .header-context__map-head small,
      .header-context__map-grid small,
      .header-context__localbar small {
        color: #8393a7;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      .header-context__map-head b {
        font-size: 14px;
      }
      .header-context__map-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        padding: 14px;
      }
      .header-context__map-grid section {
        display: grid;
        gap: 7px;
      }
      .header-context__map-grid section + section {
        padding-left: 14px;
        border-left: 1px solid #304052;
      }
      .header-context__map-grid span,
      .header-context__localbar span {
        color: #c7d0dc;
        font-size: 10px;
        font-weight: 700;
      }
      .header-context__selected {
        color: #1687ff !important;
      }
      .header-context__live {
        color: #f5d91a !important;
      }
      .header-context__live i {
        display: inline-block;
        width: 5px;
        height: 5px;
        margin-right: 5px;
        border-radius: 50%;
        background: #f5d91a;
        box-shadow: 0 0 0 3px #f5d91a33;
      }
      .header-context__localbar {
        display: grid;
        grid-template-columns: 1fr 1.25fr;
        gap: 18px;
        padding: 11px 20px;
        border-bottom: 1px solid #304052;
        background: #172230;
      }
      .header-context__localbar div {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .header-context__localbar small {
        margin-right: 2px;
      }
      .header-context__content {
        position: relative;
      }
      .header-context__hero {
        display: flex;
        align-items: end;
        height: 145px;
        padding: 20px;
        background: linear-gradient(118deg, #321c69, #12425b 54%, #e8891d);
        font-size: 28px;
        font-weight: 800;
        line-height: 1.05;
      }
      .header-context__content section {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 13px;
        padding: 20px;
      }
      .header-context__content section b {
        font-size: 17px;
      }
      .header-context__content section span {
        color: #f5d91a;
        font-size: 10px;
        font-weight: 700;
      }
      .header-context__content section div {
        grid-column: 1/-1;
        height: 64px;
        border-radius: 8px;
        background: linear-gradient(90deg, #1d2a39 30%, #202d3c 30% 31%, #1d2a39 31% 64%, #202d3c 64% 65%, #1d2a39 65%);
      }
      .header-context__mobile {
        min-height: 590px;
      }
      .header-context__mobile .header-context__topbar {
        height: 48px;
        padding: 0 14px;
      }
      .header-context__mobile .header-context__topbar > b {
        font-size: 21px;
      }
      .header-context__mobile .header-context__search {
        padding: 0;
        border: 0;
        color: #fff;
        font-size: 17px;
      }
      .header-context__mobile .header-context__competition {
        min-width: 0;
        flex: 1;
        margin-left: 0;
      }
      .header-context__mobile .header-context__competition strong {
        font-size: 10px;
      }
      .header-context__mobile .header-context__modebar {
        height: 42px;
        padding: 0 14px;
      }
      .header-context__mobile .header-context__modebar b {
        max-width: 170px;
        font-size: 11px;
      }
      .header-context__popover--mobile {
        top: 48px;
        left: 0;
        width: 100%;
        border-right: 0;
        border-left: 0;
        border-radius: 0;
      }
      .header-context__mobile .header-context__map-grid {
        grid-template-columns: 1fr;
      }
      .header-context__mobile .header-context__map-grid section + section {
        padding-top: 12px;
        padding-left: 0;
        border-top: 1px solid #304052;
        border-left: 0;
      }
      .header-context__localbar--mobile {
        grid-template-columns: 1fr;
        gap: 11px;
        padding: 10px 14px;
      }
      .header-context__mobile .header-context__hero {
        height: 118px;
        padding: 14px;
        font-size: 17px;
      }
      .header-context__mobile .header-context__content section {
        padding: 18px 14px;
      }
    `,
  });
};
