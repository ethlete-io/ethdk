export type GlobalAttachedNavVariant = 'full' | 'compact' | 'handle';

import { css, drawing, html } from '@design-explore';

export const globalAttachedNavSketch = ({ variant }: { variant: GlobalAttachedNavVariant }) => {
  const state = (variant === 'compact' ? 'scrolled' : 'top') as 'top' | 'scrolled';
  const mobile = false;
  const compact = variant === 'compact';

  return drawing({
    body: html`
      <main class="global-attached">
        <section class="global-attached__wide global-attached__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false, state: 'top' }" />
        </section>
        <section class="global-attached__wide global-attached__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false, state: 'scrolled' }" />
        </section>
        <div class="global-attached__mobile-row">
          <section class="global-attached__mobile global-attached__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true, state: 'top' }" />
          </section>
          <section class="global-attached__mobile global-attached__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true, state: 'scrolled' }" />
          </section>
        </div>
      </main>

      <ng-template #page let-mobile="mobile" let-state="state">
        <article class="global-attached__page">
          ${
            state === 'top' &&
            html`
              <div class="global-attached__hero"><small>FIFAe WORLD CUP 2026™</small><b>eFootball™ Mobile</b></div>
            `
          }
          <section class="global-attached__content">
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </section>
        </article>

        <section
          class="global-attached__header${state === 'scrolled' && variant === 'handle' && 'global-attached__header--handle'}"
        >
          <header class="global-attached__primary">
            <button class="global-attached__brand-button" aria-label="FIFAe home">
              <ng-container [ngTemplateOutlet]="brand" />
            </button>
            ${
              !mobile &&
              html`
                <button class="global-attached__zone" aria-label="Gaming">
                  <ng-container [ngTemplateOutlet]="gamepad" /><span>Gaming</span>
                </button>
                <button class="global-attached__zone global-attached__zone--active" aria-label="Esports">
                  <ng-container [ngTemplateOutlet]="laurel" /><span>Esports</span>
                </button>
                <button class="global-attached__search" aria-label="Search">
                  <svg viewBox="0 0 24 24">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m15.5 15.5 5 5" /></svg
                  ><span>Search</span><kbd>ctrl</kbd><kbd>↵</kbd>
                </button>
              `
            }
            <button class="global-attached__account" aria-label="User center">TM</button>
            ${
              mobile &&
              html`
                <button class="global-attached__mobile-menu" aria-label="Global menu"><i></i><i></i><i></i></button>
              `
            }
          </header>

          ${
            state === 'top' || variant === 'full'
              ? html`
                  <ng-container
                    [ngTemplateOutlet]="competitionRow"
                    [ngTemplateOutletContext]="{ compact: false, mobile }"
                  />
                `
              : variant === 'compact'
                ? html`
                    <ng-container
                      [ngTemplateOutlet]="competitionRow"
                      [ngTemplateOutletContext]="{ compact: true, mobile }"
                    />
                  `
                : html`
                    <button class="global-attached__handle" aria-label="Open competition navigation">
                      <span class="global-attached__event-mark">26</span
                      ><span><small>COMPETITION</small><b>WORLD CUP 26</b></span
                      ><i></i><strong>LIVE · CONTINENTAL</strong><em>⌃</em>
                    </button>
                  `
          }
        </section>
        <small class="global-attached__state-label">${state === 'top' ? 'TOP OF PAGE' : 'AFTER SCROLL'}</small>
      </ng-template>

      <ng-template #competitionRow let-compact="compact" let-mobile="mobile">
        <nav class="global-attached__local${compact && 'global-attached__local--compact'}">
          <button class="global-attached__overview">
            <span class="global-attached__event-mark">26</span>
            <span><small>OVERVIEW</small><b>${mobile ? 'WORLD CUP 26' : 'FIFAe World Cup 2026™'}</b></span>
          </button>
          <div class="global-attached__links"><a>Format</a><a>Selection</a><a>Ranking</a><a>Nations</a></div>
          <button class="global-attached__stage">
            <span class="global-attached__stage-art"><i></i></span>
            <span
              ><small><em></em>LIVE NOW</small><b>${mobile ? 'Continental' : 'Continental Championship'}</b></span
            >
            <strong>⌄</strong>
          </button>
          <button class="global-attached__map" aria-label="Competition menu"><i></i><i></i><i></i><i></i></button>
        </nav>
      </ng-template>

      <ng-template #brand>
        <svg class="global-attached__brand" viewBox="0 0 105 20" aria-label="FIFAe">
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
    `,
    styles: css`
      .global-attached {
        --accent: #f0e51b;
        min-height: 1110px;
        padding: 24px;
        background: #0a0d10;
        color: #fff;
        font:
          13px/1.35 FIFAnybody,
          Inter,
          sans-serif;
      }
      .global-attached__viewport {
        position: relative;
        overflow: hidden;
        background: #12171e;
        container-type: inline-size;
      }
      .global-attached__wide {
        min-height: 285px;
      }
      .global-attached__wide + .global-attached__wide {
        margin-top: 24px;
      }
      .global-attached__mobile-row {
        display: grid;
        grid-template-columns: 300px 300px;
        gap: 24px;
        justify-content: center;
        margin-top: 24px;
      }
      .global-attached__mobile {
        min-height: 390px;
      }
      .global-attached__page {
        padding-top: 122px;
      }
      .global-attached__hero {
        display: flex;
        flex-direction: column;
        justify-content: end;
        height: 108px;
        padding: 18px;
        background:
          linear-gradient(0deg, #0a0d10df, transparent 60%),
          radial-gradient(circle at 68% 22%, #f0e51b88, transparent 22%),
          linear-gradient(120deg, #351943, #1d3c49 58%, #725d20);
      }
      .global-attached__hero small {
        color: var(--accent);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .global-attached__hero b {
        font-size: 22px;
      }
      .global-attached__content {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        padding: 18px;
        font-size: 14px;
      }
      .global-attached__content > span {
        color: var(--accent);
        font-size: 9px;
        font-weight: 800;
      }
      .global-attached__content > div {
        grid-column: 1/-1;
        height: 43px;
        border-radius: 8px;
        background: #19222d;
      }
      .global-attached__header {
        position: absolute;
        z-index: 2;
        inset: 14px 14px auto;
        border-radius: 20px;
        filter: drop-shadow(0 2px 10px #0003);
      }
      .global-attached__primary {
        display: flex;
        align-items: center;
        height: 48px;
        overflow: hidden;
        border-radius: 20px 20px 0 0;
        background: #19222d;
      }
      .global-attached__header--handle .global-attached__primary {
        border-radius: 20px;
      }
      .global-attached__brand-button,
      .global-attached__zone,
      .global-attached__search,
      .global-attached__account,
      .global-attached__mobile-menu,
      .global-attached__overview,
      .global-attached__stage,
      .global-attached__map,
      .global-attached__handle {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .global-attached__brand-button {
        display: grid;
        place-items: center;
        align-self: stretch;
        padding: 0 16px;
      }
      .global-attached__brand {
        width: 105px;
        height: 20px;
        fill: #fff;
      }
      .global-attached__zone {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        align-self: stretch;
        min-width: 80px;
        padding: 0 16px;
        color: #dbe0ea;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .global-attached__zone svg {
        width: 28px;
        height: 28px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.7;
      }
      .global-attached__zone--active {
        color: #0a7fff;
      }
      .global-attached__search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 230px;
        height: 32px;
        margin-left: auto;
        padding: 0 12px;
        border: 1px solid #374151;
        border-radius: 8px;
        background: #0a0d10;
        color: #9ba1ae;
        font-size: 9px;
        text-align: left;
      }
      .global-attached__search svg {
        width: 18px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-width: 1.8;
      }
      .global-attached__search kbd {
        margin-left: auto;
        padding: 2px 5px;
        border-radius: 4px;
        background: #283140;
        color: #798191;
        font-size: 7px;
      }
      .global-attached__search kbd + kbd {
        margin-left: -4px;
      }
      .global-attached__account {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        margin: 0 12px;
        border-radius: 50%;
        background: #283140;
        color: #dbe0ea;
        font-size: 10px;
        font-weight: 800;
      }
      .global-attached__mobile-menu {
        display: grid;
        gap: 4px;
        width: 40px;
        margin-right: 4px;
      }
      .global-attached__mobile-menu i {
        width: 17px;
        height: 2px;
        margin: auto;
        background: #fff;
      }
      .global-attached__local {
        display: flex;
        align-items: stretch;
        height: 58px;
        overflow: hidden;
        border-top: 1px solid #374151;
        border-radius: 0 0 20px 20px;
        background: #1f2937;
      }
      .global-attached__overview {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 260px;
        padding: 0 16px;
        border-bottom: 3px solid var(--accent);
        text-align: left;
      }
      .global-attached__event-mark {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        flex: 0 0 auto;
        border: 1px solid #f0e51b66;
        border-radius: 9px;
        background: linear-gradient(145deg, #49245b, #88701d);
        font-size: 11px;
        font-weight: 900;
      }
      .global-attached__overview > span:last-child,
      .global-attached__stage > span:nth-child(2),
      .global-attached__handle > span:nth-child(2) {
        display: grid;
        line-height: 1.05;
      }
      .global-attached__overview small,
      .global-attached__stage small,
      .global-attached__handle small {
        color: var(--accent);
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .global-attached__overview b {
        font-size: 10px;
      }
      .global-attached__links {
        display: flex;
        align-items: stretch;
      }
      .global-attached__links a {
        display: flex;
        align-items: center;
        padding: 0 12px;
        color: #9ba1ae;
        font-size: 9px;
        font-weight: 700;
      }
      .global-attached__stage {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 246px;
        margin-left: auto;
        padding: 0 12px;
        border-left: 1px solid #374151;
        text-align: left;
      }
      .global-attached__stage-art {
        position: relative;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        overflow: hidden;
        flex: 0 0 auto;
        border-radius: 9px;
        background:
          radial-gradient(circle at 50% 55%, #fff7, transparent 14%), linear-gradient(145deg, #34174f, #e4a62b);
      }
      .global-attached__stage-art::before,
      .global-attached__stage-art::after,
      .global-attached__stage-art i {
        position: absolute;
        width: 7px;
        height: 25px;
        border: 2px solid #fff;
        border-radius: 50%;
        content: '';
        transform: rotate(18deg);
      }
      .global-attached__stage-art::after {
        transform: rotate(-18deg);
      }
      .global-attached__stage-art i {
        transform: rotate(55deg);
      }
      .global-attached__stage small {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .global-attached__stage em {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #ff604b;
        box-shadow: 0 0 0 2px #ff604b33;
      }
      .global-attached__stage b {
        font-size: 10px;
      }
      .global-attached__stage strong {
        margin-left: auto;
        color: var(--accent);
        font-size: 14px;
      }
      .global-attached__map {
        display: grid;
        grid-template-columns: 4px 4px;
        place-content: center;
        gap: 3px;
        width: 46px;
        border-left: 1px solid #374151;
      }
      .global-attached__map i {
        width: 4px;
        height: 4px;
        border-radius: 1px;
        background: #dbe0ea;
      }
      .global-attached__local--compact {
        height: 34px;
      }
      .global-attached__local--compact .global-attached__event-mark,
      .global-attached__local--compact .global-attached__stage-art,
      .global-attached__local--compact small {
        display: none;
      }
      .global-attached__local--compact .global-attached__overview {
        min-width: 220px;
        padding-left: 14px;
      }
      .global-attached__local--compact .global-attached__stage {
        min-width: 205px;
      }
      .global-attached__handle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 310px;
        height: 34px;
        margin-left: auto;
        padding: 0 10px;
        border-radius: 0 0 12px 12px;
        background: #1f2937;
        box-shadow: 0 7px 12px #0004;
        text-align: left;
      }
      .global-attached__handle .global-attached__event-mark {
        width: 25px;
        height: 25px;
        border-radius: 7px;
        font-size: 8px;
      }
      .global-attached__handle > i {
        width: 5px;
        height: 5px;
        margin-left: auto;
        border-radius: 50%;
        background: #ff604b;
      }
      .global-attached__handle strong {
        color: #dbe0ea;
        font-size: 7px;
      }
      .global-attached__handle em {
        color: var(--accent);
        font-style: normal;
      }
      .global-attached__state-label {
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
      .global-attached__mobile .global-attached__page {
        padding-top: 112px;
      }
      .global-attached__mobile .global-attached__hero {
        height: 105px;
        padding: 13px;
      }
      .global-attached__mobile .global-attached__hero b {
        font-size: 17px;
      }
      .global-attached__mobile .global-attached__header {
        inset: 14px 10px auto;
      }
      .global-attached__mobile .global-attached__brand-button {
        padding: 0 12px;
      }
      .global-attached__mobile .global-attached__brand {
        width: 88px;
        height: 17px;
      }
      .global-attached__mobile .global-attached__account {
        width: 34px;
        height: 34px;
        margin-left: auto;
        margin-right: 2px;
      }
      .global-attached__mobile .global-attached__local {
        height: 54px;
      }
      .global-attached__mobile .global-attached__overview {
        min-width: 0;
        flex: 1;
        gap: 6px;
        padding: 0 7px;
      }
      .global-attached__mobile .global-attached__overview .global-attached__event-mark {
        width: 29px;
        height: 29px;
      }
      .global-attached__mobile .global-attached__links {
        display: none;
      }
      .global-attached__mobile .global-attached__stage {
        min-width: 112px;
        gap: 5px;
        padding: 0 6px;
      }
      .global-attached__mobile .global-attached__stage-art {
        display: none;
      }
      .global-attached__mobile .global-attached__stage b {
        font-size: 8px;
      }
      .global-attached__mobile .global-attached__map {
        width: 34px;
      }
      .global-attached__mobile .global-attached__local--compact {
        height: 32px;
      }
      .global-attached__mobile .global-attached__local--compact .global-attached__overview {
        padding-left: 9px;
      }
      .global-attached__mobile .global-attached__local--compact .global-attached__stage {
        min-width: 104px;
      }
      .global-attached__mobile .global-attached__handle {
        width: 215px;
        height: 32px;
      }
      .global-attached__mobile .global-attached__handle strong {
        overflow: hidden;
        max-width: 77px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @container (max-width: 1279px) {
        .global-attached__zone span {
          display: none;
        }
      }
      @container (max-width: 1023px) {
        .global-attached__search {
          justify-content: center;
          width: 32px;
          padding: 0;
          border: 0;
          background: transparent;
        }
        .global-attached__search span,
        .global-attached__search kbd {
          display: none;
        }
        .global-attached__links a:nth-last-child(-n + 2) {
          display: none;
        }
      }
      @container (max-width: 767px) {
        .global-attached__zone,
        .global-attached__search {
          display: none;
        }
      }
    `,
  });
};
