import { STAGES, STATIC_ITEMS } from '../01-entry/fixture';

export type VisibleNavigationVariant = 'wrap' | 'timeline' | 'outline';

import { css, drawing, html } from '@design-explore';

export const visibleNavigationSketch = ({ variant }: { variant: VisibleNavigationVariant }) =>
  drawing({
    body: html`
      <main
        class="visible${variant === 'outline' && 'visible--outline'}${variant === 'timeline' && 'visible--timeline'}"
      >
        <section class="wide shell">
          <header><b>FIFAe</b><span>GAMING</span><span>ESPORTS</span><i>⌕ Search</i></header>
          <div class="wide-hero">FIFAe World Cup 2026™ ft. eFootball Mobile</div>
          ${variant === 'outline' && html` <aside class="outline"><ng-container [ngTemplateOutlet]="map" /></aside> `}
          <section class="wide-main">
            ${variant === 'wrap' && html` <ng-container [ngTemplateOutlet]="wrap" /> `}
            ${variant === 'timeline' && html` <ng-container [ngTemplateOutlet]="map" /> `}
            <article>
              <b>Matchups</b><span>More Matchups</span>
              <div></div>
              <b>Standings</b>
              <p>Follow every active matchup and the route to the FIFAe World Cup.</p>
            </article>
          </section>
        </section>
        <section class="narrow shell">
          <header><b>FIFAe</b><span>☰</span></header>
          <div class="narrow-hero">FIFAe World Cup 2026™<br />ft. eFootball Mobile</div>
          ${
            variant === 'wrap'
              ? html` <ng-container [ngTemplateOutlet]="wrap" /> `
              : html` <ng-container [ngTemplateOutlet]="map" /> `
          }
          <article>
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </article>
        </section>
      </main>
      <ng-template #wrap>
        <nav class="wrap-map">
          <div class="pages">
            ${STATIC_ITEMS.map((item) => html` <span class="${item === 'Overview' && 'current'}">${item}</span> `)}
          </div>
          <div class="stage-row">
            ${STAGES.map(
              (stage) => html`
                <span class="${stage.name === 'Continental championship' && 'live'}"><i></i>${stage.name}</span>
              `,
            )}
          </div>
        </nav>
      </ng-template>
      <ng-template #map>
        <nav class="timeline-map">
          <div class="map-head"><b>Competition route</b><span>All stages and pages</span></div>
          <div class="route">
            ${STAGES.map(
              (stage) => html`
                <div class="${stage.name === 'Continental championship' && 'live'}">
                  <i></i><b>${stage.name}</b><small>${stage.detail}</small>
                </div>
              `,
            )}
          </div>
          <div class="pages">
            ${STATIC_ITEMS.map((item) => html` <span class="${item === 'Overview' && 'current'}">${item}</span> `)}
          </div>
        </nav>
      </ng-template>
    `,
    styles: css`
      .visible {
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
      .shell {
        position: relative;
        overflow: hidden;
        border: 1px solid #293442;
        border-radius: 13px;
        background: #111923;
        box-shadow: 0 18px 40px #0005;
      }
      .shell header {
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
      .shell header b {
        color: white;
        font-size: 20px;
        letter-spacing: -1px;
      }
      .shell header i {
        margin-left: auto;
        padding: 8px 48px 8px 12px;
        border: 1px solid #2c3b4d;
        border-radius: 7px;
        color: #748095;
        font-style: normal;
        font-weight: 400;
      }
      .wide-hero,
      .narrow-hero {
        display: flex;
        align-items: end;
        padding: 20px;
        background: linear-gradient(118deg, #321c69, #12425b 54%, #e8891d);
        font-size: 28px;
        font-weight: 800;
        line-height: 1.05;
      }
      .wide-hero {
        height: 145px;
      }
      .wide-main {
        padding: 18px 20px;
      }
      .wide-main article,
      .narrow article {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 13px;
        margin-top: 20px;
      }
      .wide-main article b,
      .narrow article b {
        font-size: 17px;
      }
      .wide-main article span,
      .narrow article span {
        color: #f5d91a;
        font-size: 10px;
        font-weight: 700;
      }
      .wide-main article div,
      .narrow article div {
        grid-column: 1/-1;
        height: 64px;
        border-radius: 8px;
        background: linear-gradient(90deg, #1d2a39 30%, #202d3c 30% 31%, #1d2a39 31% 64%, #202d3c 64% 65%, #1d2a39 65%);
      }
      .wide-main article p {
        grid-column: 1/-1;
        margin: 0;
        color: #8d99a9;
      }
      .pages {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .pages span {
        padding: 8px 10px;
        border-radius: 6px;
        background: #202d3c;
        color: #c4cbd5;
        font-size: 11px;
        font-weight: 700;
      }
      .pages .current {
        background: #f5d91a;
        color: #182231;
      }
      .wrap-map {
        display: grid;
        gap: 10px;
        padding-bottom: 15px;
        border-bottom: 1px solid #2a3542;
      }
      .stage-row {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .stage-row span {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 8px 10px;
        border: 1px solid #2d3c4c;
        border-radius: 6px;
        color: #bbc5d1;
        font-size: 11px;
        font-weight: 700;
      }
      .stage-row i {
        width: 7px;
        height: 7px;
        border: 2px solid #728096;
        border-radius: 50%;
      }
      .stage-row .live {
        border-color: #f5d91a;
        color: #f5d91a;
      }
      .stage-row .live i {
        border-color: #f5d91a;
        background: #f5d91a;
        box-shadow: 0 0 0 3px #f5d91a44;
      }
      .timeline-map {
        padding: 14px;
        border: 1px solid #2b3b4d;
        border-radius: 9px;
        background: #172230;
      }
      .map-head {
        display: flex;
        justify-content: space-between;
        margin-bottom: 13px;
      }
      .map-head span {
        color: #8492a3;
        font-size: 10px;
      }
      .route {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0;
        margin: 0 4px 15px;
      }
      .route > div {
        position: relative;
        display: grid;
        gap: 4px;
        padding: 15px 9px 4px;
        border-top: 2px solid #536174;
      }
      .route > div:not(:last-child)::after {
        position: absolute;
        top: -4px;
        right: -2px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #536174;
        content: '';
      }
      .route i {
        position: absolute;
        top: -7px;
        left: 0;
        width: 10px;
        height: 10px;
        border: 2px solid #536174;
        border-radius: 50%;
        background: #172230;
      }
      .route b {
        font-size: 10px;
        line-height: 1.15;
      }
      .route small {
        color: #8492a3;
        font-size: 9px;
      }
      .route .live {
        border-color: #f5d91a;
      }
      .route .live i {
        border-color: #f5d91a;
        background: #f5d91a;
        box-shadow: 0 0 0 3px #f5d91a33;
      }
      .route .live b {
        color: #f5d91a;
      }
      .outline {
        position: absolute;
        z-index: 2;
        top: 193px;
        bottom: 0;
        left: 0;
        width: 235px;
        padding: 14px;
        background: #16212e;
        border-right: 1px solid #2b3b4d;
      }
      .outline .timeline-map {
        border: 0;
        background: transparent;
        padding: 0;
      }
      .outline .route {
        grid-template-columns: 1fr;
        margin: 0 0 15px;
      }
      .outline .route > div {
        padding: 8px 0 8px 18px;
      }
      .outline .route > div:not(:last-child)::after {
        top: auto;
        right: auto;
        bottom: -4px;
        left: 1px;
      }
      .outline .route i {
        top: 7px;
      }
      .visible--outline .wide-main {
        margin-left: 235px;
        padding: 20px;
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
      .narrow-hero {
        height: 110px;
        padding: 14px;
        font-size: 17px;
      }
      .narrow > .wrap-map {
        padding: 12px 14px;
      }
      .narrow > .timeline-map {
        margin: 12px 14px;
      }
      .narrow .route {
        grid-template-columns: 1fr;
        margin-bottom: 14px;
      }
      .narrow .route > div {
        padding: 8px 0 8px 18px;
      }
      .narrow .route > div:not(:last-child)::after {
        top: auto;
        right: auto;
        bottom: -4px;
        left: 1px;
      }
      .narrow .route i {
        top: 7px;
      }
      .narrow article {
        margin: 18px 14px;
      }
      .visible--outline .narrow .timeline-map {
        margin-top: 12px;
      }
    `,
  });
