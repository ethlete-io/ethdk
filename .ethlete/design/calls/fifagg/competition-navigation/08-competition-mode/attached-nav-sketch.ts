export type AttachedNavVariant = 'merge' | 'rail' | 'recall';
export type AttachedNavState = 'top' | 'scrolled';

import { css, drawing, html } from '@design-explore';

export const attachedNavSketch = ({ variant }: { variant: AttachedNavVariant }) => {
  const state = (variant === 'rail' ? 'scrolled' : 'top') as 'top' | 'scrolled';
  const mobile = false;

  return drawing({
    body: html`
      <main
        class="attached-nav${variant === 'rail' && 'attached-nav--rail'}${variant === 'recall' && 'attached-nav--recall'}"
      >
        <section class="attached-nav__state-row">
          <div class="attached-nav__desktop attached-nav__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false, state: 'top' }" />
          </div>
          <div class="attached-nav__mobile attached-nav__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true, state: 'top' }" />
          </div>
        </section>
        <section class="attached-nav__state-row">
          <div class="attached-nav__desktop attached-nav__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false, state: 'scrolled' }" />
          </div>
          <div class="attached-nav__mobile attached-nav__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true, state: 'scrolled' }" />
          </div>
        </section>
      </main>

      <ng-template #page let-mobile="mobile" let-state="state">
        <article class="attached-nav__page">
          ${
            state === 'top' &&
            html` <div class="attached-nav__hero"><small>FIFAe WORLD CUP 2026™</small><b>eFootball™ Mobile</b></div> `
          }
          <section class="attached-nav__content">
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </section>
        </article>

        <section class="attached-nav__header${state === 'scrolled' && 'attached-nav__header--scrolled'}">
          <header class="attached-nav__primary">
            <button class="attached-nav__brand-button" aria-label="FIFAe home">
              <ng-container [ngTemplateOutlet]="brand" />
            </button>
            <button class="attached-nav__global" aria-label="Back to global navigation">
              <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg><span>Global</span>
            </button>

            ${
              state === 'scrolled' &&
              variant === 'merge' &&
              html` <ng-container [ngTemplateOutlet]="compactContext" [ngTemplateOutletContext]="{ mobile }" /> `
            }
            ${
              state === 'scrolled' &&
              variant === 'recall' &&
              html`
                <button class="attached-nav__recall" aria-label="Open competition navigation">
                  <span>WC26</span><b>LIVE</b><i>⌄</i>
                </button>
              `
            }

            <button class="attached-nav__search" aria-label="Search this competition">
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
            </button>
            <button class="attached-nav__account" aria-label="User center">TM</button>
            <button class="attached-nav__primary-menu" aria-label="Open competition menu"><i></i><i></i><i></i></button>
          </header>

          ${
            state === 'top' ||
            (variant === 'rail' &&
              html`
                <nav class="attached-nav__local${state === 'scrolled' && 'attached-nav__local--compact'}">
                  <button class="attached-nav__overview">
                    <span class="attached-nav__event-mark">26</span>
                    <span><small>OVERVIEW</small><b>${mobile ? 'WORLD CUP 26' : 'FIFAe World Cup 2026™'}</b></span>
                  </button>
                  <div class="attached-nav__links"><a>Format</a><a>Selection</a><a>Ranking</a><a>Nations</a></div>
                  <button class="attached-nav__stage">
                    <span class="attached-nav__stage-art"><i></i></span>
                    <span
                      ><small><em></em>LIVE NOW</small
                      ><b>${mobile ? 'Continental' : 'Continental Championship'}</b></span
                    >
                    <strong>⌄</strong>
                  </button>
                  <button class="attached-nav__map" aria-label="Open competition menu">
                    <i></i><i></i><i></i><i></i>
                  </button>
                </nav>
              `)
          }
        </section>
        <small class="attached-nav__state-label">${state === 'top' ? 'TOP OF PAGE' : 'AFTER SCROLL'}</small>
      </ng-template>

      <ng-template #compactContext let-mobile="mobile">
        <button class="attached-nav__compact-overview" aria-label="Competition overview">
          <span class="attached-nav__event-mark">26</span><b>${mobile ? 'WC26' : 'FIFAe World Cup 2026™'}</b>
        </button>
        <button class="attached-nav__compact-stage" aria-label="Open stage navigation">
          <span class="attached-nav__stage-art"><i></i></span
          ><span
            ><small><em></em>LIVE</small><b>${mobile ? 'CONT.' : 'Continental Championship'}</b></span
          ><strong>⌄</strong>
        </button>
      </ng-template>

      <ng-template #brand>
        <svg class="attached-nav__brand" viewBox="0 0 105 20" aria-label="FIFAe">
          <path d="M98.577 0H64.774v20h33.803v-4.51H69.284V4.51h24.783v4.032H71.672v4.51h26.905V0Z" />
          <path d="M0 0v20h6.225v-7.223h4.481l1.593-4.371H6.225V4.357h7.545L15.358 0H0Z" />
          <path
            d="M23.488 0h-6.225v20h6.225V0ZM27.772 0v20h6.225v-7.223h4.481l1.593-4.371h-6.074V4.357h7.545L43.129 0H27.772Z"
          />
          <path
            d="M60.953 20h-6.287l-.813-2.687h-7.034L46.04 20h-6.13L47.198 0h6.472l7.283 20Zm-8.13-6.53-2.488-8.331-2.405 8.331h4.893Z"
          />
          <path
            d="M102.222 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-.77-3.141h.843c.557 0 .836.221.836.664 0 .391-.198.594-.593.61l.61.992h-.432l-.588-.975h-.255v.975h-.421V.859Z"
          />
        </svg>
      </ng-template>
    `,
    styles: css`
      .attached-nav {
        --accent: #f0e51b;
        min-height: 720px;
        padding: 24px;
        background: #0a0d10;
        color: #fff;
        font:
          13px/1.35 FIFAnybody,
          Inter,
          sans-serif;
      }
      .attached-nav__state-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 24px;
      }
      .attached-nav__state-row + .attached-nav__state-row {
        margin-top: 24px;
      }
      .attached-nav__viewport {
        position: relative;
        min-height: 320px;
        overflow: hidden;
        background: #12171e;
        container-type: inline-size;
      }
      .attached-nav__page {
        padding-top: 74px;
      }
      .attached-nav__hero {
        display: flex;
        flex-direction: column;
        justify-content: end;
        height: 130px;
        padding: 18px;
        background:
          linear-gradient(0deg, #0a0d10d9, transparent 60%),
          radial-gradient(circle at 68% 22%, #f0e51b88, transparent 22%),
          linear-gradient(120deg, #351943, #1d3c49 58%, #725d20);
      }
      .attached-nav__hero small {
        color: var(--accent);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .attached-nav__hero b {
        font-size: 22px;
      }
      .attached-nav__content {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        padding: 18px;
        font-size: 14px;
      }
      .attached-nav__content > span {
        color: var(--accent);
        font-size: 9px;
        font-weight: 800;
      }
      .attached-nav__content > div {
        grid-column: 1/-1;
        height: 52px;
        border-radius: 8px;
        background: #19222d;
      }
      .attached-nav__header {
        position: absolute;
        z-index: 2;
        inset: 14px 14px auto;
        overflow: hidden;
        border-radius: 18px;
        background: #19222d;
        box-shadow: 0 2px 10px #0003;
      }
      .attached-nav__primary {
        display: flex;
        align-items: center;
        height: 48px;
        background: #19222d;
      }
      .attached-nav__brand-button,
      .attached-nav__global,
      .attached-nav__search,
      .attached-nav__account,
      .attached-nav__primary-menu,
      .attached-nav__overview,
      .attached-nav__stage,
      .attached-nav__map,
      .attached-nav__compact-overview,
      .attached-nav__compact-stage,
      .attached-nav__recall {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .attached-nav__brand-button {
        display: grid;
        place-items: center;
        align-self: stretch;
        width: 137px;
        padding: 0 16px;
      }
      .attached-nav__brand {
        width: 105px;
        height: 20px;
        fill: #fff;
      }
      .attached-nav__global {
        display: flex;
        align-items: center;
        gap: 5px;
        align-self: stretch;
        padding: 0 12px;
        border-left: 1px solid #374151;
        border-right: 1px solid #374151;
        color: #9ba1ae;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .attached-nav__global svg,
      .attached-nav__search svg {
        width: 17px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2;
      }
      .attached-nav__search {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        margin-left: auto;
        border: 1px solid #374151;
        border-radius: 8px;
        color: #dbe0ea;
      }
      .attached-nav__account {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        margin-left: 8px;
        border-radius: 50%;
        background: #283140;
        color: #dbe0ea;
        font-size: 9px;
        font-weight: 800;
      }
      .attached-nav__primary-menu {
        display: flex;
        justify-content: center;
        gap: 3px;
        width: 36px;
        margin: 0 5px;
      }
      .attached-nav__primary-menu i {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--accent);
      }
      .attached-nav__local {
        display: flex;
        align-items: stretch;
        height: 56px;
        border-top: 1px solid #374151;
        background: #1f2937;
      }
      .attached-nav__overview {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 232px;
        padding: 0 14px;
        border-bottom: 3px solid var(--accent);
        text-align: left;
      }
      .attached-nav__event-mark {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 1px solid #f0e51b66;
        border-radius: 9px;
        background: linear-gradient(145deg, #49245b, #88701d);
        color: #fff;
        font-size: 11px;
        font-weight: 900;
      }
      .attached-nav__overview > span:last-child,
      .attached-nav__stage > span:nth-child(2),
      .attached-nav__compact-stage > span:nth-child(2) {
        display: grid;
        line-height: 1.05;
      }
      .attached-nav__overview small,
      .attached-nav__stage small,
      .attached-nav__compact-stage small {
        color: var(--accent);
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .attached-nav__overview b {
        font-size: 10px;
      }
      .attached-nav__links {
        display: flex;
        align-items: stretch;
      }
      .attached-nav__links a {
        display: flex;
        align-items: center;
        padding: 0 9px;
        color: #9ba1ae;
        font-size: 9px;
        font-weight: 700;
      }
      .attached-nav__stage {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 214px;
        margin-left: auto;
        padding: 0 10px;
        border-left: 1px solid #374151;
        text-align: left;
      }
      .attached-nav__stage-art {
        position: relative;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        overflow: hidden;
        flex: 0 0 auto;
        border-radius: 8px;
        background:
          radial-gradient(circle at 50% 55%, #fff7, transparent 14%), linear-gradient(145deg, #34174f, #e4a62b);
      }
      .attached-nav__stage-art::before,
      .attached-nav__stage-art::after,
      .attached-nav__stage-art i {
        position: absolute;
        width: 7px;
        height: 25px;
        border: 2px solid #fff;
        border-radius: 50%;
        content: '';
        transform: rotate(18deg);
      }
      .attached-nav__stage-art::after {
        transform: rotate(-18deg);
      }
      .attached-nav__stage-art i {
        transform: rotate(55deg);
      }
      .attached-nav__stage small {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .attached-nav__stage em,
      .attached-nav__compact-stage em {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #ff604b;
        box-shadow: 0 0 0 2px #ff604b33;
      }
      .attached-nav__stage b {
        font-size: 10px;
      }
      .attached-nav__stage strong,
      .attached-nav__compact-stage strong {
        margin-left: auto;
        color: var(--accent);
        font-size: 14px;
      }
      .attached-nav__map {
        display: grid;
        grid-template-columns: 4px 4px;
        place-content: center;
        gap: 3px;
        width: 42px;
        border-left: 1px solid #374151;
      }
      .attached-nav__map i {
        width: 4px;
        height: 4px;
        border-radius: 1px;
        background: #dbe0ea;
      }
      .attached-nav__compact-overview,
      .attached-nav__compact-stage,
      .attached-nav__recall {
        display: flex;
        align-items: center;
        align-self: stretch;
      }
      .attached-nav__compact-overview {
        gap: 7px;
        min-width: 205px;
        padding: 0 10px;
        border-left: 1px solid #374151;
        border-bottom: 2px solid var(--accent);
        text-align: left;
      }
      .attached-nav__compact-overview .attached-nav__event-mark {
        width: 27px;
        height: 27px;
        border-radius: 7px;
        font-size: 9px;
      }
      .attached-nav__compact-overview b {
        overflow: hidden;
        font-size: 9px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .attached-nav__compact-stage {
        gap: 7px;
        min-width: 190px;
        padding: 0 9px;
        border-left: 1px solid #374151;
        text-align: left;
      }
      .attached-nav__compact-stage .attached-nav__stage-art {
        width: 28px;
        height: 28px;
      }
      .attached-nav__compact-stage b {
        font-size: 8px;
      }
      .attached-nav__recall {
        gap: 6px;
        margin-left: 9px;
        padding: 0 10px;
        border: 1px solid #f0e51b55;
        border-radius: 8px;
        background: #f0e51b0c;
        font-size: 9px;
      }
      .attached-nav__recall b {
        color: #ff735f;
        font-size: 7px;
      }
      .attached-nav__recall i {
        color: var(--accent);
        font-style: normal;
      }
      .attached-nav__local--compact {
        height: 32px;
      }
      .attached-nav__local--compact .attached-nav__overview {
        min-width: 200px;
      }
      .attached-nav__local--compact .attached-nav__event-mark,
      .attached-nav__local--compact .attached-nav__stage-art {
        display: none;
      }
      .attached-nav__local--compact .attached-nav__overview small,
      .attached-nav__local--compact .attached-nav__stage small {
        display: none;
      }
      .attached-nav__local--compact .attached-nav__stage {
        min-width: 180px;
      }
      .attached-nav__state-label {
        position: absolute;
        right: 8px;
        bottom: 7px;
        padding: 3px 6px;
        border-radius: 4px;
        background: #0a0d10aa;
        color: #798191;
        font-size: 6px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .attached-nav__mobile .attached-nav__page {
        padding-top: 72px;
      }
      .attached-nav__mobile .attached-nav__hero {
        height: 112px;
        padding: 13px;
      }
      .attached-nav__mobile .attached-nav__hero b {
        font-size: 17px;
      }
      .attached-nav__mobile .attached-nav__header {
        inset: 14px 10px auto;
      }
      .attached-nav__mobile .attached-nav__brand-button {
        width: 91px;
        padding: 0 8px;
      }
      .attached-nav__mobile .attached-nav__brand {
        width: 77px;
        height: 15px;
      }
      .attached-nav__mobile .attached-nav__global {
        width: 34px;
        padding: 0 7px;
      }
      .attached-nav__mobile .attached-nav__global span,
      .attached-nav__mobile .attached-nav__search {
        display: none;
      }
      .attached-nav__mobile .attached-nav__account {
        margin-left: auto;
      }
      .attached-nav__mobile .attached-nav__local {
        height: 50px;
      }
      .attached-nav__mobile .attached-nav__overview {
        min-width: 0;
        flex: 1;
        gap: 6px;
        padding: 0 7px;
      }
      .attached-nav__mobile .attached-nav__overview .attached-nav__event-mark {
        width: 29px;
        height: 29px;
      }
      .attached-nav__mobile .attached-nav__links {
        display: none;
      }
      .attached-nav__mobile .attached-nav__stage {
        min-width: 112px;
        gap: 5px;
        padding: 0 6px;
      }
      .attached-nav__mobile .attached-nav__stage-art {
        width: 29px;
        height: 29px;
      }
      .attached-nav__mobile .attached-nav__stage b {
        font-size: 8px;
      }
      .attached-nav__mobile .attached-nav__map {
        width: 34px;
      }
      .attached-nav__mobile .attached-nav__compact-overview {
        min-width: 74px;
        gap: 4px;
        padding: 0 5px;
      }
      .attached-nav__mobile .attached-nav__compact-overview .attached-nav__event-mark {
        width: 24px;
        height: 24px;
      }
      .attached-nav__mobile .attached-nav__compact-overview b {
        font-size: 7px;
      }
      .attached-nav__mobile .attached-nav__compact-stage {
        min-width: 68px;
        gap: 3px;
        padding: 0 4px;
      }
      .attached-nav__mobile .attached-nav__compact-stage .attached-nav__stage-art {
        display: none;
      }
      .attached-nav__mobile .attached-nav__compact-stage b {
        font-size: 6px;
      }
      .attached-nav__mobile .attached-nav__compact-stage strong {
        font-size: 10px;
      }
      .attached-nav__mobile .attached-nav__recall {
        margin-left: 5px;
        padding: 0 7px;
      }
      .attached-nav__mobile .attached-nav__local--compact {
        height: 30px;
      }
      .attached-nav__mobile .attached-nav__local--compact .attached-nav__overview {
        min-width: 0;
      }
      .attached-nav__mobile .attached-nav__local--compact .attached-nav__stage {
        min-width: 105px;
      }
      @container (max-width: 1023px) {
        .attached-nav__links a:nth-last-child(-n + 2) {
          display: none;
        }
        .attached-nav__overview {
          min-width: 205px;
        }
      }
      @container (max-width: 767px) {
        .attached-nav__links {
          display: none;
        }
      }
    `,
  });
};
