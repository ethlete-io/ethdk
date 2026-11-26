import { BandTreatment, KERBE_VARS } from '../../shared/kerbe';
import { kerbeBand, KERBE_BAND_STYLES } from '../../shared/kerbe-band.component';
import {
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

/** How much of the brand reference the toolbar's buttons wear. */
export type ButtonRule = 'plate' | 'bracket' | 'patina' | 'light';

/**
 * The day as calls 4 to 9 settled it, under the top row call 10 settled. Only `rule` changes:
 * how much of the brand reference the five controls in that row wear.
 */
import { css, drawing, html } from '@design-explore';

export const buttonDay = ({ rule }: { rule: ButtonRule }) => {
  const patina = rule === 'patina';
  const bracket = rule === 'bracket';
  const light = rule === 'light';

  return drawing({
    body: html`
      <div class="window" style="--k-gutter: ${GUTTER_REM}rem;">
        <div class="chrome">
          <button class="btn btn--sm btn--icon" type="button" aria-label="Previous day">
            <span class="label">←</span>
            <span class="frame"></span>
          </button>
          <span class="date">Tuesday, 16 September</span>
          <button class="btn btn--sm btn--icon" type="button" aria-label="Next day">
            <span class="label">→</span>
            <span class="frame"></span>
          </button>
          <button class="btn btn--sm btn--quiet" type="button"><span class="label">Today</span></button>
          <span class="grow"></span>
          <span class="total">7h 15m</span>
          <button class="btn${patina && 'btn--patina'}" type="button">
            <span class="label">Add an entry</span>
            <span class="frame"></span>
            ${patina && html` <span class="wash"></span> `}
            ${
              bracket &&
              html`
                <span class="bk bk--tl"></span>
                <span class="bk bk--tr"></span>
                <span class="bk bk--br"></span>
                <span class="bk bk--bl"></span>
              `
            }
            ${
              light &&
              html`
                <span class="rail rail--t"></span>
                <span class="rail rail--r"></span>
                <span class="rail rail--b"></span>
                <span class="rail rail--l"></span>
              `
            }
          </button>
          <button class="btn" type="button">
            <span class="label">Debug</span>
            <span class="frame"></span>
          </button>
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
        --acc: 214 181 105;
        --acc-rest: 0.26;

        position: relative;
        display: inline-flex;
        box-sizing: border-box;
        height: 34px;
        flex: none;
        align-items: center;
        justify-content: center;
        padding: 0 14px;
        border: 0;
        background: #171e22;
        font: 500 10.5px/1 var(--k-sans);
        letter-spacing: 0.2em;
        white-space: nowrap;
        text-transform: uppercase;
        color: var(--k-ink-2);
        transition:
          background-color 300ms,
          letter-spacing 300ms;
      }

      .btn:hover {
        background: #1d262b;
        letter-spacing: 0.24em;
      }

      .btn:active {
        background: #141a1d;
      }

      .btn--patina {
        --acc: 63 179 154;
        --acc-rest: 0.3;
      }

      .btn--sm {
        height: 30px;
        padding: 0 11px;
      }

      .btn--icon {
        width: 30px;
        padding: 0;
      }

      .btn--icon .label {
        padding-left: 0.2em;
      }

      .btn--quiet,
      .btn--quiet:hover,
      .btn--quiet:active {
        background: transparent;
        color: var(--k-ink-3);
      }

      .btn--quiet:hover {
        color: var(--k-ink-2);
      }

      .label {
        position: relative;
        z-index: 1;
      }

      .frame {
        position: absolute;
        inset: 0;
        box-shadow: inset 0 0 0 1px rgb(var(--acc) / var(--acc-rest));
        transition: box-shadow 300ms;
      }

      .btn:hover .frame {
        box-shadow: inset 0 0 0 1px rgb(var(--acc) / 0.38);
      }

      .wash {
        position: absolute;
        inset: 1px;
        background: linear-gradient(to top, rgb(63 179 154 / 0.2), rgb(63 179 154 / 0) 68%);
        opacity: 0;
        transition: opacity 300ms;
      }

      .btn:hover .wash {
        opacity: 1;
      }

      /* 4 / 9 / 3 / 4 is the reference's figure: inset 4, arms 9, the second L 3 further in, arms 4. */
      .bk {
        position: absolute;
        box-sizing: border-box;
        width: 9px;
        height: 9px;
        border-width: 0;
        border-style: solid;
        border-color: rgb(var(--acc) / 0.32);
        background-image:
          linear-gradient(rgb(var(--acc)), rgb(var(--acc))), linear-gradient(rgb(var(--acc)), rgb(var(--acc)));
        background-repeat: no-repeat;
        background-origin: border-box;
        background-size: 1px 1px;
        transition: border-color 300ms;
      }

      .btn:hover .bk {
        border-color: rgb(var(--acc) / 0.46);
      }

      .bk::after {
        position: absolute;
        box-sizing: border-box;
        width: 4px;
        height: 4px;
        border-width: 0;
        border-style: solid;
        border-color: inherit;
        opacity: 0.65;
        content: '';
      }

      .bk--tl {
        top: 4px;
        left: 4px;
        border-top-width: 1px;
        border-left-width: 1px;
        background-position:
          right top,
          left bottom;
      }

      .bk--tl::after {
        top: 2px;
        left: 2px;
        border-top-width: 1px;
        border-left-width: 1px;
      }

      .bk--tr {
        top: 4px;
        right: 4px;
        border-top-width: 1px;
        border-right-width: 1px;
        background-position:
          left top,
          right bottom;
      }

      .bk--tr::after {
        top: 2px;
        right: 2px;
        border-top-width: 1px;
        border-right-width: 1px;
      }

      .bk--br {
        right: 4px;
        bottom: 4px;
        border-right-width: 1px;
        border-bottom-width: 1px;
        background-position:
          right top,
          left bottom;
      }

      .bk--br::after {
        right: 2px;
        bottom: 2px;
        border-right-width: 1px;
        border-bottom-width: 1px;
      }

      .bk--bl {
        bottom: 4px;
        left: 4px;
        border-bottom-width: 1px;
        border-left-width: 1px;
        background-position:
          left top,
          right bottom;
      }

      .bk--bl::after {
        bottom: 2px;
        left: 2px;
        border-bottom-width: 1px;
        border-left-width: 1px;
      }

      .rail {
        position: absolute;
        background-repeat: no-repeat;
        filter: drop-shadow(0 0 4px rgb(240 224 180 / 0.55));
        animation: k-lap 4s linear infinite;
      }

      .rail--t,
      .rail--b {
        right: 0;
        left: 0;
        height: 1px;
        background-image: linear-gradient(90deg, rgb(240 224 180 / 0), rgb(240 224 180), rgb(240 224 180 / 0));
        background-size: 30px 1px;
      }

      .rail--l,
      .rail--r {
        top: 0;
        bottom: 0;
        width: 1px;
        background-image: linear-gradient(180deg, rgb(240 224 180 / 0), rgb(240 224 180), rgb(240 224 180 / 0));
        background-size: 1px 30px;
      }

      .rail--t {
        top: 0;
      }

      .rail--r {
        right: 0;
        animation-delay: 1s;
      }

      .rail--b {
        bottom: 0;
        animation-delay: 3s;
        animation-direction: reverse;
      }

      .rail--l {
        left: 0;
        animation-direction: reverse;
      }

      @keyframes k-lap {
        0% {
          background-position: 0% 0%;
          opacity: 0;
        }

        2% {
          opacity: 1;
        }

        23% {
          opacity: 1;
        }

        25% {
          background-position: 100% 100%;
          opacity: 0;
        }

        100% {
          background-position: 100% 100%;
          opacity: 0;
        }
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
};
