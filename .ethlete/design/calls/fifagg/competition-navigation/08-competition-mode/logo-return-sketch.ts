import { COMPETITION_LINKS, JOURNEY_LINKS, PRIMARY_LINKS } from './fixture';

export type LogoReturnVariant = 'persistent' | 'expand';

import { css, drawing, html } from '@design-explore';

export const logoReturnSketch = ({ variant }: { variant: LogoReturnVariant }) => {
  const mobile = false;

  return drawing({
    body: html`
      <main class="logo-return${variant === 'expand' && 'logo-return--expand'}">
        <section class="logo-return__wide logo-return__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false }" />
        </section>
        <div class="logo-return__breakpoint-row">
          <section class="logo-return__medium logo-return__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false }" />
          </section>
          <section class="logo-return__mobile logo-return__viewport">
            <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true }" />
          </section>
        </div>
      </main>

      <ng-template #page let-mobile="mobile">
        <article class="logo-return__page">
          <div class="logo-return__hero"><small>FIFAe WORLD CUP 2026™</small><b>eFootball™ Mobile</b></div>
          <section>
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </section>
        </article>

        <section class="logo-return__header">
          <header class="logo-return__bar">
            <button class="logo-return__brand-button" aria-label="FIFAe home">
              <ng-container [ngTemplateOutlet]="brand" />
            </button>
            <button class="logo-return__identity" aria-label="Competition navigation">
              <span class="logo-return__game">e</span>
              <span><small>WORLD CUP 2026™</small><b>${mobile ? 'MOBILE' : 'eFOOTBALL™ MOBILE'}</b></span>
              ${variant === 'expand' && html` <i>⌄</i> `}
            </button>
            ${
              !mobile &&
              variant === 'persistent' &&
              html`
                <nav class="logo-return__links">
                  ${PRIMARY_LINKS.map(
                    (item) => html` <a class="${item === 'Overview' && 'logo-return__selected'}">${item}</a> `,
                  )}
                </nav>
              `
            }
            ${
              !mobile &&
              html`
                <button class="logo-return__search" aria-label="Search this competition">
                  <svg viewBox="0 0 24 24">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m15.5 15.5 5 5" />
                  </svg>
                  <span>Search competition</span>
                </button>
              `
            }
            <button class="logo-return__account" aria-label="User center">TM</button>
            <button class="logo-return__menu" aria-label="Competition menu"><i></i><i></i><i></i></button>
          </header>

          ${
            !mobile && variant === 'expand'
              ? html`
                  <section class="logo-return__hover-panel">
                    <div class="logo-return__hover-head">
                      <div>
                        <small>CURRENT COMPETITION</small>
                        <h2>FIFAe World Cup 2026™ <span>ft. eFootball™ Mobile</span></h2>
                      </div>
                      <div class="logo-return__hover-search">
                        <svg viewBox="0 0 24 24">
                          <circle cx="10.5" cy="10.5" r="6.5" />
                          <path d="m15.5 15.5 5 5" />
                        </svg>
                        <span>Search this competition</span>
                      </div>
                    </div>
                    <div class="logo-return__hover-columns">
                      <nav>
                        <small>COMPETITION</small>
                        ${COMPETITION_LINKS.map(
                          (item) => html`
                            <a class="${item === 'Overview' && 'logo-return__selected'}">${item}<i>›</i></a>
                          `,
                        )}
                      </nav>
                      <nav>
                        <small>JOURNEY</small>
                        ${JOURNEY_LINKS.map(
                          (item) => html`
                            <a class="${item === 'Continental Championship' && 'logo-return__active-stage'}"
                              ><span></span>${item}<i>›</i></a
                            >
                          `,
                        )}
                      </nav>
                    </div>
                  </section>
                `
              : mobile
                ? html`
                    <section class="logo-return__mobile-menu">
                      <div class="logo-return__mobile-search">
                        <svg viewBox="0 0 24 24">
                          <circle cx="10.5" cy="10.5" r="6.5" />
                          <path d="m15.5 15.5 5 5" />
                        </svg>
                        <span>Search this competition</span>
                      </div>
                      <nav>
                        <small>COMPETITION</small>
                        ${COMPETITION_LINKS.map(
                          (item) => html`
                            <a class="${item === 'Overview' && 'logo-return__selected'}">${item}<i>›</i></a>
                          `,
                        )}
                      </nav>
                      <nav>
                        <small>JOURNEY</small>
                        ${JOURNEY_LINKS.map(
                          (item) => html`
                            <a class="${item === 'Continental Championship' && 'logo-return__active-stage'}">
                              <span></span>${item}<i>›</i>
                            </a>
                          `,
                        )}
                      </nav>
                    </section>
                  `
                : ''
          }
        </section>
      </ng-template>

      <ng-template #brand>
        <svg class="logo-return__brand" viewBox="0 0 105 20" aria-label="FIFAe">
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
      .logo-return {
        --accent: #f0e51b;
        min-height: 940px;
        padding: 26px;
        background: #0a0d10;
        color: #fff;
        font:
          13px/1.35 FIFAnybody,
          Inter,
          sans-serif;
      }
      .logo-return__viewport {
        position: relative;
        overflow: hidden;
        background: #12171e;
        container-type: inline-size;
      }
      .logo-return__wide {
        min-height: 400px;
      }
      .logo-return__breakpoint-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 28px;
        margin-top: 28px;
      }
      .logo-return__medium,
      .logo-return__mobile {
        min-height: 500px;
      }
      .logo-return__page {
        padding-top: 88px;
      }
      .logo-return__hero {
        display: flex;
        flex-direction: column;
        justify-content: end;
        height: 184px;
        padding: 24px;
        background:
          linear-gradient(0deg, #0a0d10dd, transparent 62%),
          radial-gradient(circle at 68% 22%, #f0e51b88, transparent 22%),
          linear-gradient(120deg, #351943, #1d3c49 58%, #725d20);
      }
      .logo-return__hero small {
        color: var(--accent);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .logo-return__hero > b {
        font-size: 28px;
      }
      .logo-return__page > section {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        padding: 24px;
        font-size: 17px;
      }
      .logo-return__page > section > span {
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
      }
      .logo-return__page > section > div {
        grid-column: 1/-1;
        height: 80px;
        border-radius: 10px;
        background: #19222d;
      }
      .logo-return__header {
        position: absolute;
        z-index: 2;
        inset: 20px 18px auto;
        overflow: hidden;
        border-radius: 20px;
        background: #19222d;
        box-shadow: 0 2px 10px #0003;
      }
      .logo-return__bar {
        display: flex;
        align-items: center;
        height: 48px;
        background: linear-gradient(90deg, #f0e51b09, transparent 48%), #19222d;
      }
      .logo-return__brand-button,
      .logo-return__identity,
      .logo-return__search,
      .logo-return__account,
      .logo-return__menu {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .logo-return__brand-button {
        position: relative;
        display: grid;
        place-items: center;
        align-self: stretch;
        width: 139px;
        padding: 0 17px;
        border-right: 1px solid #374151;
      }
      .logo-return__brand {
        width: 105px;
        height: 20px;
        fill: #fff;
      }
      .logo-return__identity {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 174px;
        padding: 0 13px;
        border-right: 1px solid #374151;
        text-align: left;
      }
      .logo-return__game {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 1px solid #f0e51b66;
        border-radius: 8px;
        color: var(--accent);
        font-size: 19px;
        font-weight: 900;
      }
      .logo-return__identity > span:last-child {
        display: grid;
        line-height: 1.05;
      }
      .logo-return__identity small {
        color: var(--accent);
        font-size: 6px;
        font-weight: 800;
        letter-spacing: 0.06em;
      }
      .logo-return__identity b {
        font-size: 10px;
      }
      .logo-return__identity > i {
        margin-left: auto;
        color: var(--accent);
        font-style: normal;
      }
      .logo-return__links {
        display: flex;
        align-self: stretch;
      }
      .logo-return__links a {
        display: flex;
        align-items: center;
        padding: 0 8px;
        color: #9ba1ae;
        font-size: 9px;
        font-weight: 700;
      }
      .logo-return__links .logo-return__selected {
        border-bottom: 2px solid var(--accent);
        color: #fff;
      }
      .logo-return__search {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        overflow: hidden;
        width: 32px;
        height: 32px;
        margin-left: auto;
        border: 1px solid #374151;
        border-radius: 7px;
        color: #798191;
        font-size: 8px;
        transition: width 0.2s ease;
        white-space: nowrap;
      }
      .logo-return__search:hover,
      .logo-return__search:focus-visible {
        justify-content: start;
        width: 138px;
        padding: 0 8px;
      }
      .logo-return__search span {
        display: none;
      }
      .logo-return__search:hover span,
      .logo-return__search:focus-visible span {
        display: inline;
      }
      .logo-return__search svg,
      .logo-return__mobile-search svg {
        width: 15px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-width: 1.8;
      }
      .logo-return__menu {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 38px;
        height: 38px;
        margin: 0 5px;
        border-radius: 8px;
      }
      .logo-return__menu i {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--accent);
      }
      .logo-return__account {
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
      .logo-return__hover-panel {
        min-height: 292px;
        padding: 20px 24px 24px;
        background: radial-gradient(100% 100% at 0 0, #f0e51b0d, transparent 60%), #1f2937;
      }
      .logo-return__hover-head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 20px;
        padding-bottom: 18px;
        border-bottom: 1px solid #374151;
      }
      .logo-return__hover-head small,
      .logo-return__hover-columns small {
        color: var(--accent);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      .logo-return__hover-head h2 {
        margin: 4px 0 0;
        font-size: 18px;
      }
      .logo-return__hover-head h2 span {
        color: #9ba1ae;
        font-weight: 500;
      }
      .logo-return__hover-search {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 190px;
        padding: 9px 10px;
        border: 1px solid #4b5563;
        border-radius: 8px;
        color: #9ba1ae;
        font-size: 9px;
      }
      .logo-return__hover-search svg {
        width: 16px;
        fill: none;
        stroke: currentcolor;
        stroke-width: 1.8;
      }
      .logo-return__hover-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 36px;
        padding-top: 17px;
      }
      .logo-return__hover-columns nav {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 12px;
      }
      .logo-return__hover-columns small {
        grid-column: 1/-1;
        margin-bottom: 3px;
      }
      .logo-return__hover-columns a {
        display: flex;
        align-items: center;
        min-height: 31px;
        padding: 0 8px;
        border-radius: 5px;
        color: #dbe0ea;
        font-size: 10px;
        font-weight: 700;
      }
      .logo-return__hover-columns a > i {
        margin-left: auto;
        color: #798191;
        font-size: 16px;
        font-style: normal;
      }
      .logo-return__hover-columns a > span {
        width: 7px;
        height: 7px;
        margin-right: 7px;
        border: 2px solid #798191;
        border-radius: 50%;
      }
      .logo-return__hover-columns .logo-return__selected {
        background: #283140;
      }
      .logo-return__hover-columns .logo-return__selected > i,
      .logo-return__hover-columns .logo-return__active-stage > i {
        color: var(--accent);
      }
      .logo-return__hover-columns .logo-return__active-stage > span {
        border-color: var(--accent);
        background: var(--accent);
      }
      .logo-return__medium .logo-return__hover-panel {
        display: none;
      }
      .logo-return__mobile .logo-return__page {
        padding-top: 82px;
      }
      .logo-return__mobile .logo-return__hero {
        height: 125px;
        padding: 15px;
      }
      .logo-return__mobile .logo-return__hero > b {
        font-size: 19px;
      }
      .logo-return__mobile .logo-return__header {
        inset: 20px 14px auto;
      }
      .logo-return__mobile .logo-return__brand-button {
        width: 103px;
        padding: 0 9px;
        border-right: 0;
      }
      .logo-return__mobile .logo-return__brand {
        width: 84px;
        height: 16px;
      }
      .logo-return__mobile .logo-return__identity {
        min-width: 0;
        flex: 1;
        gap: 5px;
        padding: 0 5px;
      }
      .logo-return__mobile .logo-return__game {
        width: 27px;
        height: 27px;
        font-size: 17px;
      }
      .logo-return__mobile .logo-return__identity b {
        font-size: 8px;
      }
      .logo-return__mobile .logo-return__menu {
        width: 34px;
        margin: 0 3px;
      }
      .logo-return__mobile-menu {
        min-height: 500px;
        padding: 15px 17px 22px;
        background: radial-gradient(100% 90% at 0 0, #f0e51b10, transparent 60%), #1f2937;
      }
      .logo-return__mobile-search {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 11px;
        border: 1px solid #4b5563;
        border-radius: 8px;
        color: #9ba1ae;
        font-size: 10px;
      }
      .logo-return__mobile-menu nav {
        display: grid;
        gap: 3px;
        margin-top: 17px;
      }
      .logo-return__mobile-menu nav > small {
        margin-bottom: 4px;
        color: var(--accent);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      .logo-return__mobile-menu a {
        display: flex;
        align-items: center;
        min-height: 30px;
        padding: 0 8px;
        border-radius: 5px;
        color: #dbe0ea;
        font-size: 10px;
        font-weight: 700;
      }
      .logo-return__mobile-menu a > i {
        margin-left: auto;
        color: #798191;
        font-size: 16px;
        font-style: normal;
      }
      .logo-return__mobile-menu .logo-return__selected {
        background: #283140;
        color: #fff;
      }
      .logo-return__mobile-menu .logo-return__selected > i {
        color: var(--accent);
      }
      .logo-return__mobile-menu a > span {
        width: 7px;
        height: 7px;
        margin-right: 8px;
        border: 2px solid #798191;
        border-radius: 50%;
      }
      .logo-return__mobile-menu .logo-return__active-stage > span {
        border-color: var(--accent);
        background: var(--accent);
        box-shadow: 0 0 0 3px #f0e51b22;
      }
      .logo-return__mobile-menu .logo-return__active-stage > i {
        color: var(--accent);
      }
      .logo-return__mobile .logo-return__account {
        flex: 0 0 auto;
        margin-left: 2px;
      }
      @container (max-width: 1023px) {
        .logo-return__links {
          display: none;
        }
        .logo-return__identity {
          min-width: 160px;
        }
      }
      @container (max-width: 767px) {
        .logo-return__search {
          display: none;
        }
      }
    `,
  });
};
