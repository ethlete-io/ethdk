import { css, html } from '@design-explore';
import { BandTreatment, KERBE_VARS } from '../../../kerbe';
import { KERBE_BAND_STYLES, kerbeBand } from '../../../kerbe-band.component';
import {
  AxisRule,
  DAY_HEIGHT_REM,
  GUTTER_REM,
  HOURS,
  LANES,
  MARKS,
  NOW_REM,
  RUNGS,
  STORIES,
  STRIP_ROW_REM,
} from './fixture';

const TREATMENT: BandTreatment = 'inlay';

/**
 * The day with the break drawn the way call 6 settled it: 2px rules across the full width, a
 * hatched gutter block, and a pause sign on its own ground that shrinks under 3rem. Only `rule`
 * changes: what the axis gives the reader to measure with.
 */
export const axisDay = (rule: AxisRule) => html`
  <div class="window">
    <div class="chrome">
      <span class="mark">KERBE</span>
      <span class="date">Tuesday, 16 September</span>
      <span class="total">7h 15m</span>
    </div>

    <div class="timeline">
      <div class="head">
        <span class="head-gutter"></span>
        ${LANES.map((lane) => html`<span class="head-lane" style="min-width: ${lane.widthRem}rem">${lane.label}</span>`)}
      </div>

      <div class="scroller">
        <div class="strip">
          ${STORIES.map(
            (story, i) => html`
              <span class="story" style="top: ${i * STRIP_ROW_REM}rem">
                <span class="story-title">${story.title}</span>
                <span class="story-rows">${story.rows} rows</span>
              </span>
            `,
          )}
        </div>

        <div class="axis axis--${rule}" style="height: ${DAY_HEIGHT_REM}rem">
          ${RUNGS.map(
            (rung) => html`
              <div class="rung ${rung.half && 'rung--half'}" style="top: ${rung.topRem}rem">
                <span class="rung-tick"></span>
                <span class="rung-line"></span>
              </div>
            `,
          )}
          ${HOURS.map(
            (hour) => html`
              <div class="hour" style="top: ${hour.topRem}rem">
                <span class="hour-label"><span class="hour-text">${hour.hour}:00</span></span>
                <span class="hour-notch"></span>
                <span class="hour-line"></span>
              </div>
            `,
          )}
          ${MARKS.map(
            (mark) => html`
              <div class="brk" style="top: ${mark.topRem}rem; height: ${mark.heightRem}rem">
                ${LANES.map((lane) => html`<span class="brk-cell" style="min-width: ${lane.widthRem}rem"></span>`)}
                <span class="brk-hatch"></span>
                <span class="brk-edge brk-edge--top"></span>
                <span class="brk-edge brk-edge--bottom"></span>
                <span class="brk-sign">
                  <span class="brk-pause ${mark.short && 'brk-pause--small'}"></span>
                </span>
              </div>
            `,
          )}

          <div class="now" style="top: ${NOW_REM}rem"><span class="now-dot"></span></div>

          <div class="lanes">
            ${LANES.map(
              (lane) => html`
                <div class="lane" style="min-width: ${lane.widthRem}rem">
                  ${lane.laid.map(
                    (laid) => html`
                      <div
                        class="slot"
                        style="top: ${laid.topRem}rem; left: ${laid.inlineOffset}%; width: ${laid.inlineSize}%"
                      >
                        ${kerbeBand({ band: laid.band, treatment: TREATMENT })}
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
`;

/** The styles `axisDay` needs, for a drawing to include in its own `styles`. */
export const AXIS_DAY_STYLES = css`
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
    font-family: var(--k-mono);
    font-size: 1.1rem;
    letter-spacing: 0.32em;
    color: var(--k-brass);
  }

  .date {
    flex: 1;
    font-size: 1.3rem;
    color: var(--k-ink);
  }

  .total {
    font-family: var(--k-mono);
    font-size: 1.2rem;
    color: var(--k-ink-3);
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
    width: ${GUTTER_REM}rem;
    flex: none;
  }

  .head-lane {
    flex: 1;
    flex-basis: 0;
    overflow: hidden;
    padding: 0.6rem 0.8rem;
    border-left: 1px solid rgb(255 255 255 / 0.06);
    font-family: var(--k-mono);
    font-size: 1.05rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--k-ink-3);
  }

  .scroller {
    min-height: 0;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: rgb(140 134 118 / 0.3) transparent;
  }

  .strip {
    position: relative;
    height: ${STORIES.length * STRIP_ROW_REM}rem;
    margin: 0.6rem 0 0.8rem ${GUTTER_REM}rem;
  }

  .story {
    position: absolute;
    right: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    height: 2rem;
    padding: 0 0.8rem;
    border-left: 3px solid var(--k-brass);
    background: rgb(214 181 105 / 0.08);
    font-size: 1.2rem;
    color: var(--k-ink);
  }

  .story-title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .story-rows {
    flex: none;
    font-family: var(--k-mono);
    font-size: 1.05rem;
    color: var(--k-ink-3);
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
    width: ${GUTTER_REM - 0.8}rem;
    flex: none;
    text-align: right;
    font-family: var(--k-mono);
    font-size: 1.05rem;
    color: var(--k-ink-3);
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

  .hour-notch {
    display: none;
    position: absolute;
    left: ${GUTTER_REM - 1.4}rem;
    width: 1.4rem;
    height: 2px;
    background: rgb(169 161 146 / 0.45);
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
    width: ${GUTTER_REM}rem;
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

  .axis--hour .rung {
    display: none;
  }

  .axis--ruler .hour-notch {
    display: block;
  }

  .axis--half-line .rung--half .rung-line {
    background: rgb(255 255 255 / 0.03);
  }

  .axis--ruler .hour-line {
    background: none;
  }

  .axis--ruler .rung-tick::after {
    background: rgb(140 134 118 / 0.42);
  }

  .axis--ruler .rung--half .rung-tick::after {
    width: 1rem;
  }

  .brk {
    position: absolute;
    right: 0;
    left: ${GUTTER_REM}rem;
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
    left: ${-GUTTER_REM}rem;
    width: ${GUTTER_REM}rem;
    border-top: 1px solid rgb(140 134 118 / 0.26);
    border-bottom: 1px solid rgb(140 134 118 / 0.26);
    background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.3) 0 1px, transparent 1px 5px);
  }

  .brk-edge {
    position: absolute;
    right: 0;
    left: ${-GUTTER_REM}rem;
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
    left: ${-GUTTER_REM}rem;
    display: flex;
    width: ${GUTTER_REM}rem;
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
    left: ${GUTTER_REM}rem;
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
    inset: 0 0 0 ${GUTTER_REM}rem;
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

  ${KERBE_BAND_STYLES}
`;
