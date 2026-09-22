export type EsportsMenuEntryVariant = 'featured' | 'group';

import { css, drawing, html } from '@design-explore';

export const esportsMenuEntrySketch = ({ variant }: { variant: EsportsMenuEntryVariant }) => {
  const compact = variant === 'group';

  return drawing({
    body: html`
      <main class="esports-entry${variant === 'group' && 'esports-entry--group'}">
        <section class="esports-entry__desktop esports-entry__viewport">
          <ng-container *ngTemplateOutlet="menu; context: { compact: false }" />
        </section>
        <section class="esports-entry__mobile esports-entry__viewport">
          <ng-container *ngTemplateOutlet="menu; context: { compact: true }" />
        </section>
      </main>
      <ng-template #menu let-compact="compact">
        <header class="esports-entry__topbar">
          <b>FIFA<span>e</span></b
          ><button>🎮</button><button class="esports-entry__active">♛</button><i>${compact ? '⌕' : '⌕'}</i
          ><strong>↪&nbsp; Login</strong>
        </header>
        <section class="esports-entry__panel">
          <div class="esports-entry__panel-head"><b>ESPORTS</b><span>${compact ? '×' : 'ESC · ×'}</span></div>
          <nav class="esports-entry__games">
            <span>ROCKET<br />LEAGUE</span><b>⊖ eFOOTBALL<sup>™</sup></b
            ><span>◉ FOOTBALL<br />MANAGER</span><span>◒ EA FC</span><span>UFL</span>
          </nav>
          ${
            variant === 'featured'
              ? html`
                  <section class="esports-entry__featured">
                    <small>FEATURED COMPETITION · eFOOTBALL</small
                    ><b>FIFAe World Cup 2026™<br />ft. eFootball™ Mobile</b><span>View competition <i>›</i></span>
                  </section>
                  <section class="esports-entry__columns esports-entry__columns--featured">
                    <div><small>MATCHUPS</small><b>All Matchups</b><b>Player Matchups</b><b>Team Matchups</b></div>
                    <div><small>COMMUNITY</small><b>All Nations</b><b>All Teams</b><b>All Players</b></div>
                  </section>
                `
              : html`
                  <section class="esports-entry__columns">
                    <div>
                      <small>COMPETITIONS</small><b class="esports-entry__current">FIFAe World Cup 2026™<i>›</i></b
                      ><b>All Competitions</b><b>Player Competitions</b><b>Team Competitions</b>
                    </div>
                    <div><small>MATCHUPS</small><b>All Matchups</b><b>Player Matchups</b><b>Team Matchups</b></div>
                    <div><small>COMMUNITY</small><b>All Nations</b><b>All Teams</b><b>All Players</b></div>
                  </section>
                `
          }
        </section>
        <article class="esports-entry__page">
          <b>Overview</b><span>Competition Format</span><span>Selection Process</span>
          <h2>Matchups</h2>
          <div></div>
        </article>
      </ng-template>
    `,
    styles: css`
      .esports-entry {
        display: grid;
        grid-template-columns: 1fr 330px;
        gap: 28px;
        min-height: 650px;
        padding: 26px;
        background: #0d131b;
        color: #dce3ee;
        font:
          13px/1.3 Inter,
          Arial,
          sans-serif;
      }
      .esports-entry__viewport {
        position: relative;
        overflow: hidden;
        min-height: 610px;
        border: 1px solid #26313d;
        background: linear-gradient(#101821d9, #101821ee), linear-gradient(135deg, #6f5825, #1f403d);
      }
      .esports-entry__topbar {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 48px;
        height: 78px;
        padding: 0 25px;
        border-radius: 20px 20px 0 0;
        background: #182433;
      }
      .esports-entry__topbar > b {
        color: #fff;
        font-size: 33px;
        letter-spacing: -2px;
      }
      .esports-entry__topbar > b span {
        font-size: 13px;
        vertical-align: top;
      }
      .esports-entry__topbar button {
        padding: 0;
        border: 0;
        background: none;
        color: #dce3ee;
        font-size: 22px;
      }
      .esports-entry__topbar .esports-entry__active {
        align-self: stretch;
        width: 90px;
        border: 2px solid #f6f8fb;
        border-radius: 4px;
        color: #fff;
      }
      .esports-entry__topbar > i {
        margin-left: auto;
        color: #fff;
        font-size: 28px;
        font-style: normal;
      }
      .esports-entry__topbar > strong {
        padding: 15px 27px;
        border-radius: 14px;
        background: #1584f8;
        color: #071521;
        font-size: 14px;
      }
      .esports-entry__panel {
        position: relative;
        z-index: 1;
        min-height: 440px;
        padding: 28px 26px;
        background: linear-gradient(110deg, #203650, #1e2d3e 78%);
      }
      .esports-entry__panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .esports-entry__panel-head b {
        color: #fff;
        font-size: 21px;
      }
      .esports-entry__panel-head span {
        color: #dce3ee;
      }
      .esports-entry__games {
        display: flex;
        align-items: center;
        gap: 36px;
        margin: 36px 0 26px;
        padding-bottom: 18px;
        border-bottom: 1px solid #40536a;
        color: #9aa8ba;
        font-size: 15px;
        font-weight: 800;
        line-height: 0.9;
        white-space: nowrap;
      }
      .esports-entry__games b {
        align-self: stretch;
        padding: 0 22px 18px;
        border-bottom: 3px solid #1687ff;
        color: #fff;
        font-size: 17px;
      }
      .esports-entry__games sup {
        font-size: 7px;
      }
      .esports-entry__featured {
        display: grid;
        grid-template-columns: 1.45fr 1fr auto;
        align-items: center;
        gap: 24px;
        padding: 17px;
        border: 1px solid #3e6188;
        border-left: 3px solid #1687ff;
        border-radius: 5px;
        background: #1b2d42;
      }
      .esports-entry__featured small,
      .esports-entry__columns small {
        display: block;
        margin-bottom: 16px;
        color: #1687ff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.1em;
      }
      .esports-entry__featured b {
        color: #fff;
        font-size: 17px;
        line-height: 1.18;
      }
      .esports-entry__featured span {
        color: #1687ff;
        font-weight: 800;
      }
      .esports-entry__featured i,
      .esports-entry__current i {
        margin-left: 8px;
        font-size: 22px;
        font-style: normal;
      }
      .esports-entry__columns {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 42px;
        margin-top: 28px;
      }
      .esports-entry__columns--featured {
        grid-template-columns: 1fr 1fr;
        margin-left: 0;
      }
      .esports-entry__columns div {
        display: grid;
        gap: 21px;
        align-content: start;
      }
      .esports-entry__columns b {
        color: #dce3ee;
        font-size: 17px;
      }
      .esports-entry__columns .esports-entry__current {
        display: flex;
        align-items: center;
        color: #fff;
      }
      .esports-entry__page {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        padding: 28px 25px;
        color: #8e9bad;
        font-size: 17px;
        font-weight: 800;
      }
      .esports-entry__page > b {
        color: #f1e514;
      }
      .esports-entry__page h2 {
        flex-basis: 100%;
        margin: 25px 0 0;
        color: #fff;
      }
      .esports-entry__page div {
        flex-basis: 100%;
        height: 80px;
        border-radius: 12px;
        background: #202c3c;
      }
      .esports-entry__mobile .esports-entry__topbar {
        height: 61px;
        gap: 20px;
        padding: 0 16px;
        border-radius: 16px 16px 0 0;
      }
      .esports-entry__mobile .esports-entry__topbar > b {
        font-size: 25px;
      }
      .esports-entry__mobile .esports-entry__topbar .esports-entry__active {
        width: 48px;
      }
      .esports-entry__mobile .esports-entry__topbar > strong {
        padding: 10px 12px;
        font-size: 11px;
      }
      .esports-entry__mobile .esports-entry__panel {
        min-height: 520px;
        padding: 21px 18px;
      }
      .esports-entry__mobile .esports-entry__games {
        gap: 19px;
        margin: 27px 0 20px;
        overflow: hidden;
        font-size: 11px;
      }
      .esports-entry__mobile .esports-entry__games b {
        padding: 0 10px 14px;
        font-size: 13px;
      }
      .esports-entry__mobile .esports-entry__featured {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .esports-entry__mobile .esports-entry__featured small {
        margin: 0;
      }
      .esports-entry__mobile .esports-entry__columns {
        grid-template-columns: 1fr;
        gap: 25px;
        margin-top: 22px;
      }
      .esports-entry__mobile .esports-entry__columns div {
        gap: 12px;
      }
      .esports-entry__mobile .esports-entry__columns b {
        font-size: 14px;
      }
      .esports-entry__mobile .esports-entry__page {
        display: none;
      }
    `,
  });
};
