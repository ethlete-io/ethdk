import { COMPETITION_PAGES, COMPETITION_STAGES } from './fixture';

export type HeaderZoneVariant = 'zone' | 'drill-in';

import { css, drawing, html } from '@design-explore';

export const headerZoneSketch = ({ variant }: { variant: HeaderZoneVariant }) => {
  const mobile = false;

  return drawing({
    body: html`
      <main class="gg-zone${variant === 'drill-in' && 'gg-zone--drill-in'}">
        <section class="gg-zone__desktop gg-zone__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false }" />
        </section>
        <section class="gg-zone__mobile gg-zone__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true }" />
        </section>
      </main>

      <ng-template data-page let-mobile="mobile">
        <div class="gg-zone__backdrop"></div>
        <article class="gg-zone__underlay">
          <div class="gg-zone__hero">
            <span>FIFAe World Cup 2026™<br />ft. eFootball™ Mobile</span>
          </div>
          <div class="gg-zone__content">
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </div>
        </article>
        <section class="gg-zone__header">
          <header class="gg-zone__bar">
            ${
              mobile
                ? html`
                    <button class="gg-zone__back" aria-label="Back">
                      <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
                    </button>
                    <b class="gg-zone__mobile-title">${variant === 'zone' ? 'Competition' : 'Esports · Competition'}</b>
                  `
                : html`
                    <ng-container [ngTemplateOutlet]="brand" />
                    <button class="gg-zone__global-button" aria-label="Gaming">
                      <ng-container [ngTemplateOutlet]="gamepad" /><span>Gaming</span>
                    </button>
                    <button
                      class="gg-zone__global-button${variant === 'drill-in' && 'gg-zone__global-button--active'}"
                      aria-label="Esports"
                    >
                      <ng-container [ngTemplateOutlet]="laurel" /><span>Esports</span>
                    </button>
                    ${
                      variant === 'zone' &&
                      html`
                        <button class="gg-zone__competition-button" aria-label="Current competition">
                          <ng-container [ngTemplateOutlet]="trophy" />
                          <span><small>Competition</small>World Cup 2026</span>
                        </button>
                      `
                    }
                    <button class="gg-zone__search" aria-label="Search">
                      <svg viewBox="0 0 24 24">
                        <circle cx="10.5" cy="10.5" r="6.5" />
                        <path d="m15.5 15.5 5 5" />
                      </svg>
                    </button>
                    <button class="gg-zone__login">↪ <span>Login</span></button>
                  `
            }
            ${mobile && html` <button class="gg-zone__close" aria-label="Close">×</button> `}
          </header>

          <section class="gg-zone__panel">
            <div class="gg-zone__panel-head">
              <div>
                ${
                  variant === 'drill-in' &&
                  html` <span class="gg-zone__breadcrumb">Esports <i>›</i> eFootball <i>›</i></span> `
                }
                <small>CURRENT COMPETITION</small>
                <h2>FIFAe World Cup 2026™ <span>ft. eFootball™ Mobile</span></h2>
              </div>
              ${
                !mobile &&
                html` <div class="gg-zone__escape"><kbd>ESC</kbd><button aria-label="Close">×</button></div> `
              }
            </div>

            <div class="gg-zone__map">
              <section class="gg-zone__pages">
                <small>COMPETITION</small>
                ${COMPETITION_PAGES.map(
                  (item) => html` <a class="${item === 'Overview' && 'gg-zone__current'}">${item}<i>›</i></a> `,
                )}
              </section>
              <section class="gg-zone__stages">
                <small>JOURNEY</small>
                ${COMPETITION_STAGES.map(
                  (stage) => html`
                    <a class="${stage.state === 'Active stage' && 'gg-zone__active-stage'}">
                      <span class="gg-zone__stage-marker"></span>
                      <span><em>${stage.state}</em><b>${stage.name}</b></span>
                      <i>›</i>
                    </a>
                  `,
                )}
              </section>
            </div>
          </section>
        </section>
      </ng-template>

      <ng-template #brand>
        <svg class="gg-zone__brand" aria-label="FIFAe" viewBox="0 0 105 20">
          <path d="M98.58 0H64.77v20h33.81v-4.51H69.28V4.51h24.79v4.03h-22.4v4.51h26.91V0Z" />
          <path d="M0 0v20h6.23v-7.22h4.48l1.59-4.37H6.23V4.36h7.54L15.36 0H0Z" />
          <path d="M23.49 0h-6.23v20h6.23V0ZM27.77 0v20H34v-7.22h4.48l1.59-4.37H34V4.36h7.54L43.13 0H27.77Z" />
          <path
            d="M60.95 20h-6.28l-.82-2.69h-7.03L46.04 20h-6.13L47.2 0h6.47l7.28 20Zm-8.13-6.53-2.49-8.33-2.4 8.33h4.89Z"
          />
        </svg>
      </ng-template>
      <ng-template #gamepad>
        <svg viewBox="0 0 32 24">
          <path d="M9 5h14c3 0 5 2 6 7l1 5c.5 3-3 5-5 3l-4-4H11l-4 4c-2 2-5.5 0-5-3l1-5c1-5 3-7 6-7Z" />
          <path d="M8 9v6M5 12h6M23 10h.01M26 14h.01" />
        </svg>
      </ng-template>
      <ng-template #laurel>
        <svg viewBox="0 0 32 28">
          <path
            d="M12 23C6 21 3 16 4 9M9 20c-3 0-5-2-5-5M7 15c-3-1-4-3-3-6M8 10C6 8 6 6 8 4M20 23c6-2 9-7 8-14M23 20c3 0 5-2 5-5M25 15c3-1 4-3 3-6M24 10c2-2 2-4 0-6M11 24h10"
          />
        </svg>
      </ng-template>
      <ng-template #trophy>
        <svg viewBox="0 0 28 28">
          <path d="M9 4h10v5c0 5-2 8-5 8s-5-3-5-8V4ZM9 7H5c0 4 2 6 5 6M19 7h4c0 4-2 6-5 6M14 17v5M9 24h10" />
        </svg>
      </ng-template>
    `,
    styles: css`
      ng-template:not([data-page]) {
        display: none;
      }

      .gg-zone {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 28px;
        min-height: 650px;
        padding: 26px;
        background: #0d131b;
        color: #f7f8fa;
        font:
          13px/1.35 Inter,
          Arial,
          sans-serif;
      }
      .gg-zone__viewport {
        position: relative;
        min-height: 610px;
        overflow: hidden;
        background: #111820;
      }
      .gg-zone__underlay {
        position: absolute;
        inset: 0;
        padding-top: 72px;
      }
      .gg-zone__hero {
        display: flex;
        align-items: end;
        height: 178px;
        padding: 24px;
        background:
          linear-gradient(0deg, #08111dcc, transparent 70%),
          radial-gradient(circle at 67% 20%, #ffcb6377, transparent 24%),
          linear-gradient(120deg, #1d1d46 10%, #21434b 62%, #8a6028);
        font-size: 27px;
        font-weight: 800;
        line-height: 1.05;
      }
      .gg-zone__content {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        padding: 24px;
        font-size: 16px;
      }
      .gg-zone__content > span {
        color: #f1e514;
        font-size: 11px;
        font-weight: 800;
      }
      .gg-zone__content > div {
        grid-column: 1/-1;
        height: 82px;
        border-radius: 10px;
        background: #1b2735;
      }
      .gg-zone__backdrop {
        position: absolute;
        z-index: 2;
        inset: 0;
        background: #080d13a8;
      }
      .gg-zone__header {
        position: absolute;
        z-index: 3;
        inset: 20px 18px auto;
        overflow: hidden;
        border-radius: 20px;
        background: #1f2937;
        box-shadow: 0 18px 45px #0008;
      }
      .gg-zone__bar {
        display: flex;
        align-items: center;
        height: 60px;
        background: #19222d;
      }
      .gg-zone__brand {
        width: 105px;
        height: 20px;
        margin: 0 20px;
        fill: #fff;
      }
      .gg-zone__global-button,
      .gg-zone__competition-button,
      .gg-zone__search,
      .gg-zone__login,
      .gg-zone__back,
      .gg-zone__close,
      .gg-zone__escape button {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .gg-zone__global-button {
        display: flex;
        align-items: center;
        gap: 8px;
        align-self: stretch;
        padding: 0 17px;
        color: #98a3b3;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .gg-zone__global-button svg {
        width: 29px;
        height: 27px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.7;
      }
      .gg-zone__global-button--active {
        color: #0a7fff;
      }
      .gg-zone__competition-button {
        display: flex;
        align-items: center;
        gap: 10px;
        align-self: stretch;
        padding: 0 16px;
        outline: 2px solid #f7f8fa;
        outline-offset: -2px;
        border-radius: 4px;
        background: #213047;
        text-align: left;
      }
      .gg-zone__competition-button svg {
        width: 25px;
        fill: none;
        stroke: #0a7fff;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }
      .gg-zone__competition-button span {
        display: grid;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.1;
      }
      .gg-zone__competition-button small {
        color: #0a7fff;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .gg-zone__search {
        width: 46px;
        height: 46px;
        margin-left: auto;
      }
      .gg-zone__search svg {
        width: 22px;
        fill: none;
        stroke: currentcolor;
        stroke-width: 2;
      }
      .gg-zone__login {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-right: 10px;
        padding: 12px 18px;
        border-radius: 13px;
        background: #0a7fff;
        color: #07111d;
        font-weight: 800;
      }
      .gg-zone__panel {
        min-height: 440px;
        padding: 24px 28px 28px;
        background: radial-gradient(110% 100% at 0 0, #0a7fff18, transparent 63%), #1f2937;
      }
      .gg-zone__panel-head {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: start;
        padding-bottom: 20px;
        border-bottom: 1px solid #3b4859;
      }
      .gg-zone__panel-head small,
      .gg-zone__map > section > small {
        display: block;
        margin-bottom: 6px;
        color: #0a7fff;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.11em;
      }
      .gg-zone__panel-head h2 {
        margin: 0;
        font-size: 20px;
        line-height: 1.15;
      }
      .gg-zone__panel-head h2 span {
        color: #aab4c3;
        font-weight: 600;
      }
      .gg-zone__breadcrumb {
        display: block;
        margin-bottom: 8px;
        color: #96a3b4;
        font-size: 10px;
        font-weight: 700;
      }
      .gg-zone__breadcrumb i {
        padding: 0 5px;
        color: #657286;
        font-style: normal;
      }
      .gg-zone__escape {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .gg-zone__escape kbd {
        padding: 3px 6px;
        border-radius: 4px;
        background: #19222d;
        color: #8d99a9;
        font-size: 8px;
      }
      .gg-zone__escape button {
        width: 42px;
        height: 42px;
        border: 1px solid #45546a;
        border-radius: 13px;
        font-size: 22px;
      }
      .gg-zone__map {
        display: grid;
        grid-template-columns: 0.9fr 1.1fr;
        gap: 36px;
        padding-top: 22px;
      }
      .gg-zone__pages {
        display: grid;
        align-content: start;
        gap: 3px;
      }
      .gg-zone__pages a {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 33px;
        padding: 0 10px;
        border-radius: 5px;
        color: #d6dde7;
        font-size: 13px;
        font-weight: 700;
      }
      .gg-zone__pages a i {
        color: #768397;
        font-size: 18px;
        font-style: normal;
      }
      .gg-zone__pages .gg-zone__current {
        background: #273547;
        color: #fff;
      }
      .gg-zone__pages .gg-zone__current i {
        color: #0a7fff;
      }
      .gg-zone__stages {
        display: grid;
        gap: 6px;
        align-content: start;
      }
      .gg-zone__stages a {
        display: grid;
        grid-template-columns: 12px 1fr auto;
        gap: 10px;
        align-items: center;
        min-height: 49px;
        padding: 7px 11px;
        border: 1px solid #354357;
        border-radius: 7px;
        background: #1b2532;
      }
      .gg-zone__stage-marker {
        width: 8px;
        height: 8px;
        border: 2px solid #77859a;
        border-radius: 50%;
      }
      .gg-zone__stages a > span:nth-child(2) {
        display: grid;
        gap: 1px;
      }
      .gg-zone__stages em {
        color: #8491a3;
        font-size: 8px;
        font-style: normal;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .gg-zone__stages b {
        font-size: 12px;
      }
      .gg-zone__stages a > i {
        color: #748197;
        font-size: 19px;
        font-style: normal;
      }
      .gg-zone__stages .gg-zone__active-stage {
        border-color: #0a7fff;
        background: #213047;
      }
      .gg-zone__active-stage .gg-zone__stage-marker {
        border-color: #0a7fff;
        background: #0a7fff;
        box-shadow: 0 0 0 3px #0a7fff33;
      }
      .gg-zone__active-stage em,
      .gg-zone__active-stage > i {
        color: #0a7fff !important;
      }
      .gg-zone__mobile .gg-zone__underlay {
        padding-top: 68px;
      }
      .gg-zone__mobile .gg-zone__hero {
        height: 138px;
        padding: 16px;
        font-size: 18px;
      }
      .gg-zone__mobile .gg-zone__header {
        inset: 20px 14px auto;
      }
      .gg-zone__mobile .gg-zone__bar {
        height: 52px;
        padding: 0 6px;
      }
      .gg-zone__back,
      .gg-zone__close {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
      }
      .gg-zone__back svg {
        width: 21px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.5;
      }
      .gg-zone__mobile-title {
        overflow: hidden;
        flex: 1;
        font-size: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .gg-zone__close {
        font-size: 22px;
      }
      .gg-zone__mobile .gg-zone__panel {
        min-height: 510px;
        padding: 17px 18px 22px;
      }
      .gg-zone__mobile .gg-zone__panel-head {
        padding-bottom: 14px;
      }
      .gg-zone__mobile .gg-zone__panel-head h2 {
        font-size: 16px;
      }
      .gg-zone__mobile .gg-zone__panel-head h2 span {
        display: block;
        margin-top: 2px;
        font-size: 12px;
      }
      .gg-zone__mobile .gg-zone__breadcrumb {
        font-size: 9px;
      }
      .gg-zone__mobile .gg-zone__map {
        grid-template-columns: 1fr;
        gap: 18px;
        padding-top: 16px;
      }
      .gg-zone__mobile .gg-zone__pages {
        grid-template-columns: 1fr 1fr;
      }
      .gg-zone__mobile .gg-zone__pages > small {
        grid-column: 1/-1;
      }
      .gg-zone__mobile .gg-zone__pages a {
        min-height: 30px;
        padding: 0 6px;
        font-size: 10px;
      }
      .gg-zone__mobile .gg-zone__stages a {
        min-height: 43px;
      }
    `,
  });
};
