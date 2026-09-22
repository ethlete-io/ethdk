import { COMPETITION_LINKS, JOURNEY_LINKS, PRIMARY_LINKS } from './fixture';

export type CompetitionModeVariant = 'direct' | 'menu' | 'row';

import { css, drawing, html } from '@design-explore';

export const competitionModeSketch = ({ variant }: { variant: CompetitionModeVariant }) => {
  const mobile = false;

  return drawing({
    body: html`
      <main
        class="competition-mode${variant === 'menu' && 'competition-mode--menu'}${variant === 'row' && 'competition-mode--row'}"
      >
        <section class="competition-mode__desktop competition-mode__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: false }" />
        </section>
        <section class="competition-mode__mobile competition-mode__viewport">
          <ng-container [ngTemplateOutlet]="page" [ngTemplateOutletContext]="{ mobile: true }" />
        </section>
      </main>

      <ng-template #page let-mobile="mobile">
        <article class="competition-mode__page">
          <div class="competition-mode__hero"><small>FIFAe WORLD CUP 2026™</small><b>eFootball™ Mobile</b></div>
          <section class="competition-mode__content">
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </section>
        </article>

        <section class="competition-mode__header">
          <header class="competition-mode__bar">
            <button class="competition-mode__exit">
              <svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg>
              <span><small>BACK TO</small>FIFAe</span>
            </button>
            <div class="competition-mode__identity">
              <span class="competition-mode__trophy"><ng-container [ngTemplateOutlet]="trophy" /></span>
              <span
                ><small>FIFAe WORLD CUP 2026™</small
                ><b>${mobile ? 'eFootball™ Mobile' : 'ft. eFootball™ Mobile'}</b></span
              >
            </div>

            ${
              !mobile &&
              variant === 'direct' &&
              html`
                <nav class="competition-mode__direct-links">
                  ${PRIMARY_LINKS.map(
                    (item) => html` <a class="${item === 'Overview' && 'competition-mode__selected'}">${item}</a> `,
                  )}
                </nav>
              `
            }
            ${
              !mobile &&
              html`
                <div class="competition-mode__search">
                  <svg viewBox="0 0 24 24">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m15.5 15.5 5 5" />
                  </svg>
                  <span>Search competition</span>
                  <kbd>/</kbd>
                </div>
              `
            }

            <button class="competition-mode__menu-button">
              <span>${variant === 'menu' && !mobile ? 'Competition menu' : ''}</span>
              <i></i><i></i><i></i>
            </button>
          </header>

          ${
            !mobile &&
            variant === 'row' &&
            html`
              <nav class="competition-mode__local-row">
                ${COMPETITION_LINKS.map(
                  (item) => html` <a class="${item === 'Overview' && 'competition-mode__selected'}">${item}</a> `,
                )}
                <a class="competition-mode__journey-link">Journey <b>3</b></a>
              </nav>
            `
          }
          ${
            mobile &&
            html`
              <section class="competition-mode__mobile-menu">
                <div class="competition-mode__mobile-search">
                  <svg viewBox="0 0 24 24">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m15.5 15.5 5 5" />
                  </svg>
                  <span>Search this competition</span>
                </div>
                <div class="competition-mode__menu-columns">
                  <nav>
                    <small>COMPETITION</small>
                    ${COMPETITION_LINKS.map(
                      (item) => html`
                        <a class="${item === 'Overview' && 'competition-mode__selected'}">${item}<i>›</i></a>
                      `,
                    )}
                  </nav>
                  <nav>
                    <small>JOURNEY</small>
                    ${JOURNEY_LINKS.map(
                      (item) => html`
                        <a class="${item === 'Continental Championship' && 'competition-mode__active-stage'}">
                          <span></span>${item}<i>›</i>
                        </a>
                      `,
                    )}
                  </nav>
                </div>
              </section>
            `
          }
        </section>
      </ng-template>

      <ng-template #trophy>
        <svg viewBox="0 0 30 30">
          <path d="M10 4h10v6c0 5-2 8-5 8s-5-3-5-8V4ZM10 7H5c0 4 2 7 6 7M20 7h5c0 4-2 7-6 7M15 18v6M10 26h10" />
        </svg>
      </ng-template>
    `,
    styles: css`
      .competition-mode {
        --accent: #f0e51b;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px;
        gap: 28px;
        min-height: 650px;
        padding: 26px;
        background: #0d131b;
        color: #f6f7f9;
        font:
          13px/1.35 Inter,
          Arial,
          sans-serif;
      }
      .competition-mode__viewport {
        position: relative;
        min-height: 610px;
        overflow: hidden;
        background: #10171f;
      }
      .competition-mode__page {
        padding-top: 102px;
      }
      .competition-mode__hero {
        display: flex;
        flex-direction: column;
        justify-content: end;
        height: 170px;
        padding: 24px;
        background:
          linear-gradient(0deg, #07111dcc, transparent 65%),
          radial-gradient(circle at 68% 24%, #f0e51b88, transparent 22%),
          linear-gradient(122deg, #2f174e, #183f50 58%, #6e5b20);
      }
      .competition-mode__hero small {
        color: var(--accent);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      .competition-mode__hero b {
        font-size: 28px;
      }
      .competition-mode__content {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        padding: 24px;
        font-size: 17px;
      }
      .competition-mode__content > span {
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
      }
      .competition-mode__content > div {
        grid-column: 1/-1;
        height: 78px;
        border-radius: 10px;
        background: #1b2735;
      }
      .competition-mode__header {
        position: absolute;
        z-index: 2;
        inset: 20px 18px auto;
        overflow: hidden;
        border-radius: 20px;
        background: #19222d;
        box-shadow: 0 10px 35px #0008;
      }
      .competition-mode__bar {
        display: flex;
        align-items: center;
        height: 64px;
        border-bottom: 1px solid #ffffff0d;
        background: linear-gradient(90deg, #f0e51b0b, transparent 45%), #19222d;
      }
      .competition-mode__exit,
      .competition-mode__menu-button {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .competition-mode__exit {
        display: flex;
        align-items: center;
        gap: 5px;
        align-self: stretch;
        padding: 0 16px;
        border-right: 1px solid #354153;
        color: #abb4c1;
      }
      .competition-mode__exit svg {
        width: 19px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.4;
      }
      .competition-mode__exit span {
        display: grid;
        text-align: left;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.05;
      }
      .competition-mode__exit small {
        font-size: 7px;
        letter-spacing: 0.08em;
      }
      .competition-mode__identity {
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 205px;
        padding: 0 15px;
      }
      .competition-mode__trophy {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border: 1px solid #f0e51b66;
        border-radius: 10px;
        background: #f0e51b13;
      }
      .competition-mode__trophy svg {
        width: 23px;
        fill: none;
        stroke: var(--accent);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.7;
      }
      .competition-mode__identity > span:last-child {
        display: grid;
        line-height: 1.1;
      }
      .competition-mode__identity small {
        color: var(--accent);
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.06em;
      }
      .competition-mode__identity b {
        font-size: 12px;
      }
      .competition-mode__direct-links {
        display: flex;
        align-self: stretch;
        align-items: center;
        gap: 5px;
      }
      .competition-mode__direct-links a,
      .competition-mode__local-row a {
        display: flex;
        align-items: center;
        align-self: stretch;
        padding: 0 10px;
        color: #aab4c2;
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
      }
      .competition-mode__direct-links .competition-mode__selected,
      .competition-mode__local-row .competition-mode__selected {
        border-bottom: 3px solid var(--accent);
        color: #fff;
      }
      .competition-mode__search {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 145px;
        margin-left: auto;
        padding: 8px 9px;
        border: 1px solid #3b485a;
        border-radius: 8px;
        color: #929eae;
        font-size: 9px;
      }
      .competition-mode__search svg,
      .competition-mode__mobile-search svg {
        width: 16px;
        fill: none;
        stroke: currentcolor;
        stroke-linecap: round;
        stroke-width: 1.8;
      }
      .competition-mode__search kbd {
        margin-left: auto;
        padding: 1px 4px;
        border-radius: 3px;
        background: #273344;
        color: #b4bdca;
        font-size: 8px;
      }
      .competition-mode__menu-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 50px;
        height: 48px;
        margin: 0 8px;
        border-radius: 10px;
      }
      .competition-mode__menu-button span {
        margin-right: 7px;
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        white-space: nowrap;
      }
      .competition-mode__menu-button i {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: var(--accent);
      }
      .competition-mode--row .competition-mode__menu-button,
      .competition-mode--menu .competition-mode__menu-button {
        width: auto;
        min-width: 50px;
        padding: 0 10px;
      }
      .competition-mode__local-row {
        display: flex;
        height: 42px;
        padding: 0 13px;
        background: #1f2a37;
      }
      .competition-mode__local-row a {
        padding: 0 11px;
        font-size: 9px;
      }
      .competition-mode__journey-link {
        margin-left: auto;
        color: #fff !important;
      }
      .competition-mode__journey-link b {
        display: grid;
        place-items: center;
        width: 17px;
        height: 17px;
        margin-left: 6px;
        border-radius: 50%;
        background: var(--accent);
        color: #19222d;
        font-size: 8px;
      }
      .competition-mode--row .competition-mode__page {
        padding-top: 144px;
      }
      .competition-mode__mobile .competition-mode__page {
        padding-top: 84px;
      }
      .competition-mode__mobile .competition-mode__hero {
        height: 125px;
        padding: 15px;
      }
      .competition-mode__mobile .competition-mode__hero b {
        font-size: 19px;
      }
      .competition-mode__mobile .competition-mode__header {
        inset: 20px 14px auto;
      }
      .competition-mode__mobile .competition-mode__bar {
        height: 55px;
      }
      .competition-mode__mobile .competition-mode__exit {
        width: 41px;
        padding: 0 10px;
      }
      .competition-mode__mobile .competition-mode__exit span {
        display: none;
      }
      .competition-mode__mobile .competition-mode__identity {
        min-width: 0;
        flex: 1;
        padding: 0 7px;
      }
      .competition-mode__mobile .competition-mode__trophy {
        width: 33px;
        height: 33px;
      }
      .competition-mode__mobile .competition-mode__identity small {
        font-size: 6px;
      }
      .competition-mode__mobile .competition-mode__identity b {
        font-size: 10px;
      }
      .competition-mode__mobile .competition-mode__menu-button {
        width: 39px;
        min-width: 39px;
        margin: 0 5px;
        padding: 0;
      }
      .competition-mode__mobile-menu {
        min-height: 493px;
        padding: 15px 17px 22px;
        background: radial-gradient(110% 90% at 0 0, #f0e51b12, transparent 60%), #1f2937;
      }
      .competition-mode__mobile-search {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 11px 12px;
        border: 1px solid #455266;
        border-radius: 9px;
        color: #9da8b8;
        font-size: 11px;
      }
      .competition-mode__menu-columns {
        display: grid;
        gap: 18px;
        margin-top: 18px;
      }
      .competition-mode__menu-columns nav {
        display: grid;
        gap: 3px;
      }
      .competition-mode__menu-columns small {
        margin-bottom: 4px;
        color: var(--accent);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.11em;
      }
      .competition-mode__menu-columns a {
        display: flex;
        align-items: center;
        min-height: 31px;
        padding: 0 8px;
        border-radius: 5px;
        color: #d6dce5;
        font-size: 11px;
        font-weight: 700;
      }
      .competition-mode__menu-columns a > i {
        margin-left: auto;
        color: #7b8798;
        font-size: 17px;
        font-style: normal;
      }
      .competition-mode__menu-columns .competition-mode__selected {
        background: #2a3544;
        color: #fff;
      }
      .competition-mode__menu-columns .competition-mode__selected > i {
        color: var(--accent);
      }
      .competition-mode__menu-columns a > span {
        width: 7px;
        height: 7px;
        margin-right: 8px;
        border: 2px solid #778396;
        border-radius: 50%;
      }
      .competition-mode__menu-columns .competition-mode__active-stage {
        color: #fff;
      }
      .competition-mode__menu-columns .competition-mode__active-stage > span {
        border-color: var(--accent);
        background: var(--accent);
        box-shadow: 0 0 0 3px #f0e51b22;
      }
      .competition-mode__menu-columns .competition-mode__active-stage > i {
        color: var(--accent);
      }
    `,
  });
};
