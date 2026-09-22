import { STATIC_ITEMS, STAGES } from './fixture';

export type NavigationVariant = 'switcher' | 'relevant' | 'split';

import { css, drawing, html } from '@design-explore';

export const competitionNavigationSketch = ({ variant }: { variant: NavigationVariant }) =>
  drawing({
    body: html`
      <main class="sketch${variant === 'relevant' && 'sketch--relevant'}${variant === 'split' && 'sketch--split'}">
        <section class="desktop device">
          <div class="page-head"><b>FIFAe</b><span>GAMING</span><span>ESPORTS</span><i>⌕ Search</i></div>
          <div class="hero">
            <span>FIFAe World Cup 2026™<br />ft. eFootball Mobile</span>
          </div>
          <div class="navigation">
            ${
              variant === 'switcher'
                ? html` <button class="switcher"><small>COMPETITION</small>Continental championship <b>⌄</b></button> `
                : variant === 'relevant'
                  ? html`
                      <button class="active-stage"><small>LIVE STAGE</small>Continental championship <b>→</b></button>
                      <button class="browse">Browse competition <b>⌄</b></button>
                    `
                  : html`
                      <span class="static-active">Overview</span><span>Competition format</span
                      ><span>Selection process</span><button class="stages">Stages <b>4</b>⌄</button
                      ><span>Nations</span>
                    `
            }
          </div>
          <div class="page-body">
            <b>Matchups</b><span>Live fixtures and results for the current competition stage.</span>
          </div>
          <div class="desktop-menu menu">
            <div class="menu-title">FIFAe World Cup 2026™ ft. eFootball Mobile <b>×</b></div>
            ${
              variant !== 'split'
                ? html`
                    <small>COMPETITION PAGES</small>
                    <div class="link-grid">
                      ${STATIC_ITEMS.map(
                        (item) => html` <button class="${item === 'Overview' && 'selected'}">${item}</button> `,
                      )}
                    </div>
                  `
                : ''
            }
            <small>STAGES</small>
            ${STAGES.map(
              (stage) => html`
                <button class="stage${stage.name === 'Continental championship' && 'live'}">
                  <i></i><span>${stage.name}<small>${stage.detail}</small></span
                  ><b>›</b>
                </button>
              `,
            )}
          </div>
        </section>

        <section class="mobile device">
          <div class="mobile-head"><b>FIFAe</b><span>☰</span></div>
          <div class="mobile-hero">FIFAe World Cup 2026™<br />ft. eFootball Mobile</div>
          <div class="mobile-navigation">
            ${
              variant === 'switcher'
                ? html`
                    <button class="switcher"><small>YOU ARE VIEWING</small>Continental championship <b>⌄</b></button>
                  `
                : variant === 'relevant'
                  ? html`
                      <button class="active-stage"><small>LIVE STAGE</small>Continental championship <b>→</b></button
                      ><button class="browse">Browse all <b>⌄</b></button>
                    `
                  : html` <span class="static-active">Overview</span><button class="stages">Stages <b>4</b>⌄</button> `
            }
          </div>
          <div class="mobile-body">
            <b>Matchups</b><span>More Matchups</span>
            <div></div>
            <b>Standings</b>
          </div>
          <div class="mobile-menu menu">
            <div class="menu-title">FIFAe World Cup 2026™<br />ft. eFootball Mobile <b>×</b></div>
            ${
              variant !== 'split'
                ? html`
                    <small>COMPETITION PAGES</small>
                    <div class="link-grid">
                      ${STATIC_ITEMS.map(
                        (item) => html` <button class="${item === 'Overview' && 'selected'}">${item}</button> `,
                      )}
                    </div>
                  `
                : ''
            }
            <small>STAGES</small>
            ${STAGES.map(
              (stage) => html`
                <button class="stage${stage.name === 'Continental championship' && 'live'}">
                  <i></i><span>${stage.name}<small>${stage.detail}</small></span
                  ><b>›</b>
                </button>
              `,
            )}
          </div>
        </section>
      </main>
    `,
    styles: css`
      .sketch {
        display: grid;
        grid-template-columns: 1fr 260px;
        gap: 28px;
        min-height: 660px;
        padding: 26px;
        background: #0d131b;
        color: #eef2f7;
        font:
          13px/1.3 Inter,
          Arial,
          sans-serif;
      }
      .device {
        position: relative;
        overflow: hidden;
        border: 1px solid #293442;
        border-radius: 13px;
        background: #111923;
        box-shadow: 0 18px 40px #0005;
      }
      .page-head,
      .mobile-head {
        display: flex;
        align-items: center;
        gap: 26px;
        height: 48px;
        padding: 0 20px;
        background: #182330;
        color: #bbc4d1;
        font-size: 11px;
        font-weight: 700;
      }
      .page-head b,
      .mobile-head b {
        color: #fff;
        font-size: 20px;
        letter-spacing: -1px;
      }
      .page-head i {
        margin-left: auto;
        padding: 8px 50px 8px 12px;
        border: 1px solid #2c3b4d;
        border-radius: 7px;
        color: #748095;
        font-style: normal;
        font-weight: 400;
      }
      .hero {
        height: 152px;
        display: flex;
        align-items: end;
        padding: 20px;
        background:
          linear-gradient(118deg, #321c69, #12425b 54%, #e8891d),
          radial-gradient(circle at 45% 25%, #ffedaf44, transparent 38%);
        background-blend-mode: screen;
        font-size: 28px;
        font-weight: 800;
        line-height: 1.05;
      }
      .hero span {
        text-shadow: 0 2px 12px #000;
      }
      .navigation {
        display: flex;
        align-items: center;
        gap: 22px;
        height: 58px;
        padding: 0 20px;
        border-bottom: 1px solid #273241;
        color: #aab4c2;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
      }
      .navigation button,
      .mobile-navigation button,
      .link-grid button,
      .stage {
        border: 0;
        color: inherit;
        font: inherit;
        cursor: default;
      }
      .switcher,
      .active-stage {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        min-width: 245px;
        padding: 9px 12px;
        border-radius: 7px !important;
        background: #202d3c;
        color: #fff !important;
        text-align: left;
      }
      .switcher small,
      .active-stage small {
        grid-column: 1 / -1;
        color: #f5d91a;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .switcher b,
      .active-stage b {
        grid-column: 2;
        grid-row: 2;
        color: #f5d91a;
        font-size: 17px;
      }
      .browse,
      .stages {
        padding: 10px 0;
        background: transparent;
      }
      .browse b,
      .stages b {
        margin-left: 6px;
        color: #f5d91a;
      }
      .static-active {
        align-self: stretch;
        display: flex;
        align-items: center;
        border-bottom: 3px solid #f5d91a;
        color: #f5d91a;
      }
      .page-body {
        display: grid;
        gap: 8px;
        padding: 25px 20px;
      }
      .page-body b {
        font-size: 18px;
      }
      .page-body span {
        color: #8d99a9;
      }
      .menu {
        z-index: 2;
        background: #172230;
        box-shadow: 0 18px 40px #0008;
      }
      .desktop-menu {
        position: absolute;
        top: 258px;
        left: 20px;
        width: 386px;
        padding: 15px;
        border: 1px solid #2a3a4c;
        border-radius: 10px;
      }
      .menu-title {
        display: flex;
        justify-content: space-between;
        margin-bottom: 14px;
        font-size: 14px;
        font-weight: 800;
      }
      .menu-title b {
        color: #9aa6b7;
      }
      .menu > small {
        display: block;
        margin: 15px 0 8px;
        color: #8390a1;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.09em;
      }
      .link-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .link-grid button {
        padding: 10px;
        border-radius: 6px;
        background: #202d3c;
        text-align: left;
      }
      .link-grid .selected {
        color: #f5d91a;
      }
      .stage {
        display: grid;
        grid-template-columns: 18px 1fr auto;
        gap: 8px;
        align-items: center;
        width: 100%;
        margin: 5px 0;
        padding: 8px;
        border-radius: 7px;
        background: #202d3c;
        text-align: left;
      }
      .stage i {
        width: 9px;
        height: 9px;
        border: 2px solid #657386;
        border-radius: 50%;
      }
      .stage.live {
        background: #f5d91a;
        color: #132031;
      }
      .stage.live i {
        border-color: #132031;
        box-shadow: 0 0 0 3px #f5d91a;
      }
      .stage span {
        font-weight: 700;
      }
      .stage small {
        display: block;
        margin-top: 3px;
        color: #8995a5;
        font-size: 10px;
        font-weight: 400;
      }
      .stage.live small {
        color: #4e522d;
      }
      .mobile {
        min-height: 595px;
      }
      .mobile-head {
        height: 42px;
        padding: 0 14px;
      }
      .mobile-head span {
        margin-left: auto;
      }
      .mobile-hero {
        height: 125px;
        display: flex;
        align-items: end;
        padding: 15px;
        background: linear-gradient(125deg, #57264f, #151a52 58%, #d88c25);
        font-size: 17px;
        font-weight: 800;
        line-height: 1.1;
      }
      .mobile-navigation {
        display: flex;
        gap: 8px;
        align-items: center;
        min-height: 64px;
        padding: 10px 14px;
        border-bottom: 1px solid #273241;
      }
      .mobile-navigation .switcher,
      .mobile-navigation .active-stage {
        min-width: 0;
        flex: 1;
      }
      .mobile-navigation .browse {
        font-size: 11px;
      }
      .mobile-body {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 15px;
        padding: 18px 14px;
      }
      .mobile-body span {
        color: #f5d91a;
        font-size: 10px;
        font-weight: 700;
      }
      .mobile-body div {
        grid-column: 1 / -1;
        height: 58px;
        border-radius: 8px;
        background: linear-gradient(90deg, #1d2a39 30%, #202d3c 30% 31%, #1d2a39 31% 64%, #202d3c 64% 65%, #1d2a39 65%);
      }
      .mobile-menu {
        position: absolute;
        inset: 42px 0 0;
        padding: 14px;
        border-top: 1px solid #2b3a4b;
      }
      .mobile-menu .menu-title {
        font-size: 13px;
      }
      .mobile-menu .stage {
        padding: 9px;
      }
      .sketch--relevant .desktop-menu {
        top: 258px;
        left: 286px;
      }
      .sketch--relevant .mobile-menu {
        top: 42px;
      }
      .sketch--split .desktop-menu {
        left: 225px;
      }
      .sketch--split .mobile-menu {
        top: 42px;
      }
    `,
  });
