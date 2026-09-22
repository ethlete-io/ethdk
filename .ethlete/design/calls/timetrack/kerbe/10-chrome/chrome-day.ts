import { BandTreatment, KERBE_VARS } from '../../shared/kerbe';
import { kerbeBand, KERBE_BAND_STYLES } from '../../shared/kerbe-band.component';
import {
  ChromeRule,
  DAY_HEIGHT_REM,
  GUTTER_REM,
  HOUR_LABEL_INK,
  HOUR_LABEL_REM,
  HOURS,
  LANES,
  MARKS,
  NOW_REM,
  RUNGS,
} from './fixture';

/**
 * The day as calls 4 to 9 settled it. Only `rule` changes: what the top row of the window
 * carries.
 */
import { css, drawing, html } from '@design-explore';

export const chromeDay = ({ rule }: { rule: ChromeRule }) =>
  drawing({
    body: html`
      <div class="window" style="--k-gutter: ${GUTTER_REM}rem;">
        <div class="chrome">
          ${
            rule === 'sketch'
              ? html`
                  <span class="mark mark--brass">KERBE</span>
                  <span class="date grow">Tuesday, 16 September</span>
                  <span class="total">7h 15m</span>
                `
              : html`
                  ${rule === 'app-total-mark' && html` <span class="mark">KERBE</span> `}
                  <button class="btn btn--icon" type="button" aria-label="Previous day">←</button>
                  <span class="date">Tuesday, 16 September</span>
                  <button class="btn btn--icon" type="button" aria-label="Next day">→</button>
                  <button class="btn btn--quiet" type="button">Today</button>
                  <span class="grow"></span>
                  ${rule !== 'app' && html` <span class="total">7h 15m</span> `}
                  <button class="btn" type="button">Add an entry</button>
                  <button class="btn" type="button">Debug</button>
                `
          }
        </div>

        <div class="timeline">
          <div class="head">
            <span class="head-gutter" style="width: ${GUTTER_REM}rem;"></span>
            ${LANES.map(
              (lane) => html`
                <span class="head-lane" style="minWidth: ${lane.widthRem}rem;">
                  <span class="head-name">${lane.label}</span>
                  <span class="head-total">${lane.total}</span>
                </span>
              `,
            )}
          </div>

          <div class="scroller">
            <div class="axis" style="height: ${DAY_HEIGHT_REM}rem;">
              ${RUNGS.map(
                (rung) => html`
                  <div class="rung${rung.half && 'rung--half'}" style="top: ${rung.topRem}rem;">
                    <span class="rung-tick" style="width: ${GUTTER_REM}rem;"></span>
                    <span class="rung-line"></span>
                  </div>
                `,
              )}
              ${HOURS.map(
                (hour) => html`
                  <div class="hour" style="top: ${hour.topRem}rem;">
                    <span
                      class="hour-label"
                      style="width: ${GUTTER_REM - 0.8}rem;fontSize: ${HOUR_LABEL_REM}rem;color: ${HOUR_LABEL_INK};"
                      ><span class="hour-text">${hour.text}</span></span
                    >
                    <span class="hour-line"></span>
                  </div>
                `,
              )}
              ${MARKS.map(
                (mark) => html`
                  <div class="brk" style="top: ${mark.topRem}rem;height: ${mark.heightRem}rem;">
                    ${LANES.map((lane) => html` <span class="brk-cell" style="minWidth: ${lane.widthRem}rem;"></span> `)}
                    <span class="brk-hatch"></span>
                    <span class="brk-edge brk-edge--top"></span>
                    <span class="brk-edge brk-edge--bottom"></span>
                    <span class="brk-sign">
                      <span class="brk-pause${mark.short && 'brk-pause--small'}"></span>
                    </span>
                  </div>
                `,
              )}

              <div class="now" style="top: ${NOW_REM}rem;"><span class="now-dot"></span></div>

              <div class="lanes">
                ${LANES.map(
                  (lane) => html`
                    <div class="lane" style="minWidth: ${lane.widthRem}rem;">
                      ${lane.laid.map(
                        (laid) => html`
                          <div
                            class="slot"
                            style="top: ${laid.topRem}rem;left: ${laid.inlineOffset}%;width: ${laid.inlineSize}%;"
                          >
                            ${kerbeBand({ band: laid.band, treatment: 'plate' })}
                          </div>
                        `,
                      )}
                    </div>
                  `,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    styles: css`
      ${KERBE_BAND_STYLES}
      .window {
        ${KERBE_VARS}
        display: flex;
        flex-direction: column;
        width: 110rem;
        height: 76rem;
        overflow: hidden;
        background: var(--k-ground);
        font-family: var(--k-sans);
        font-weight: 300;
        color: var(--k-ink-2);
      }

      .chrome {
        display: flex;
        flex: none;
        align-items: center;
        gap: 1.6rem;
        padding: 1rem 1.6rem;
        border-bottom: 1px solid rgb(255 255 255 / 0.06);
      }

      .mark {
        flex: none;
        font-family: var(--k-mono);
        font-size: 1.1rem;
        letter-spacing: 0.32em;
        color: var(--k-ink-3);
      }

      .mark--brass {
        color: var(--k-brass);
      }

      .date {
        flex: none;
        font-size: 1.3rem;
        white-space: nowrap;
        color: var(--k-ink);
      }

      .grow {
        flex: 1;
      }

      .total {
        flex: none;
        font-family: var(--k-mono);
        font-size: 1.2rem;
        color: var(--k-ink-3);
      }

      .btn {
        flex: none;
        padding: 0.4rem 0.8rem;
        border: 1px solid rgb(255 255 255 / 0.12);
        border-radius: 0.3rem;
        background: transparent;
        font-family: var(--k-mono);
        font-size: 1.05rem;
        white-space: nowrap;
        color: var(--k-ink-3);
      }

      .btn:hover {
        border-color: rgb(255 255 255 / 0.2);
        color: var(--k-ink-2);
      }

      .btn--icon {
        width: 2.4rem;
        padding: 0.4rem 0;
        text-align: center;
      }

      .btn--quiet {
        border-color: transparent;
      }

      .btn--quiet:hover {
        border-color: transparent;
      }

      .timeline {
        display: flex;
        min-height: 0;
        flex-direction: column;
      }

      .head {
        display: flex;
        flex: none;
        border-bottom: 1px solid rgb(255 255 255 / 0.06);
      }

      .head-gutter {
        flex: none;
      }

      .head-lane {
        display: flex;
        flex: 1;
        align-items: baseline;
        flex-basis: 0;
        gap: 0.8rem;
        overflow: hidden;
        padding: 0.6rem 0.8rem;
        border-left: 1px solid rgb(255 255 255 / 0.06);
        font-family: var(--k-mono);
        font-size: 1.05rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .head-name {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--k-ink);
      }

      .head-total {
        flex: none;
        letter-spacing: 0.02em;
        text-transform: none;
        color: var(--k-ink-3);
      }

      .scroller {
        min-height: 0;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: rgb(140 134 118 / 0.3) transparent;
      }

      .axis {
        position: relative;
      }

      /* The transform makes this a stacking context, so the z-index has to sit here and not on the label. */
      .hour {
        position: absolute;
        right: 0;
        left: 0;
        z-index: 4;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        transform: translateY(-50%);
      }

      .hour-label {
        flex: none;
        text-align: right;
        font-family: var(--k-mono);
      }

      .hour-text {
        padding: 0 0.3rem;
        background: var(--k-ground);
      }

      .hour-line {
        height: 1px;
        flex: 1;
        background: rgb(255 255 255 / 0.05);
      }

      .rung {
        position: absolute;
        right: 0;
        left: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        transform: translateY(-50%);
      }

      .rung-tick {
        display: flex;
        flex: none;
        justify-content: flex-end;
      }

      .rung-tick::after {
        width: 0.5rem;
        height: 1px;
        background: rgb(140 134 118 / 0.34);
        content: '';
      }

      .rung--half .rung-tick::after {
        width: 0.9rem;
      }

      .rung-line {
        height: 1px;
        flex: 1;
      }

      .brk {
        position: absolute;
        right: 0;
        left: var(--k-gutter);
        z-index: 3;
        display: flex;
        box-sizing: border-box;
        border-top: 1px solid rgb(140 134 118 / 0.26);
        border-bottom: 1px solid rgb(140 134 118 / 0.26);
        pointer-events: none;
      }

      .brk-cell {
        position: relative;
        flex: 1;
        flex-basis: 0;
      }

      /* The lane line has to stop at the break, so the rules read as one span across the day. */
      .brk-cell::before {
        position: absolute;
        top: 0;
        bottom: 0;
        left: -1px;
        width: 1px;
        background: var(--k-ground);
        content: '';
      }

      .brk-hatch {
        position: absolute;
        top: -1px;
        bottom: -1px;
        left: calc(var(--k-gutter) * -1);
        width: var(--k-gutter);
        border-top: 1px solid rgb(140 134 118 / 0.26);
        border-bottom: 1px solid rgb(140 134 118 / 0.26);
        background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.3) 0 1px, transparent 1px 5px);
      }

      .brk-edge {
        position: absolute;
        right: 0;
        left: calc(var(--k-gutter) * -1);
        height: 2px;
        background: rgb(169 161 146 / 0.5);
      }

      .brk-edge--top {
        top: -1px;
      }

      .brk-edge--bottom {
        bottom: -1px;
      }

      .brk-sign {
        position: absolute;
        top: 0;
        bottom: 0;
        left: calc(var(--k-gutter) * -1);
        display: flex;
        width: var(--k-gutter);
        align-items: center;
        justify-content: center;
      }

      /*
     * 4px bar and 4px gap, so the width and the pitch are both whole device pixels at scale
     * 1.25, 1.5, 2 and 3. At 2px the bar is 2.5 device pixels at 1.25, the two bars land on
     * different subpixel phases, and one renders wider than the other.
     */
      .brk-pause {
        display: flex;
        align-items: center;
        padding: 4px 6px;
        gap: 4px;
        background: var(--k-ground);
      }

      .brk-pause::before,
      .brk-pause::after {
        width: 4px;
        height: 14px;
        background: var(--k-ink-2);
        content: '';
      }

      .brk-pause--small {
        padding: 2px 5px;
      }

      .brk-pause--small::before,
      .brk-pause--small::after {
        height: 10px;
      }

      .now {
        position: absolute;
        right: 0;
        left: var(--k-gutter);
        z-index: 2;
        border-top: 1px solid var(--k-oxide);
      }

      .now-dot {
        position: absolute;
        top: -0.3rem;
        left: -0.3rem;
        width: 0.6rem;
        height: 0.6rem;
        border-radius: 50%;
        background: var(--k-oxide);
      }

      .lanes {
        position: absolute;
        inset: 0 0 0 var(--k-gutter);
        z-index: 1;
        display: flex;
      }

      .lane {
        position: relative;
        flex: 1;
        flex-basis: 0;
        border-left: 1px solid rgb(255 255 255 / 0.06);
      }

      .slot {
        position: absolute;
        padding-right: 1px;
      }
    `,
  });
