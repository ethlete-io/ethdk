import { css, drawing, html } from '@design-explore';
import { BandTreatment, KERBE_VARS } from '../../../kerbe';
import { KERBE_BAND_STYLES, kerbeBand } from '../../../kerbe-band.component';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  GUTTER_REM,
  HOUR_REM,
  HOURS,
  LANES,
  NOW_REM,
  STORIES,
  STRIP_ROW_REM,
} from './fixture';

const TREATMENT: BandTreatment = 'inlay';

export default drawing({
  body: html`
    <div class="window">
      <div class="chrome">
        <span class="mark">KERBE</span>
        <span class="date">Tuesday, 16 September</span>
        <span class="total">7h 15m</span>
      </div>

      <div class="timeline">
        <div class="head">
          <span class="head-gutter"></span>
          ${LANES.map(
            (lane) => html`
              <span class="head-lane" style="flex-grow: ${lane.narrow ? 0 : 1}; min-width: ${lane.widthRem}rem">
                ${lane.label}
              </span>
            `,
          )}
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

          <div class="axis" style="height: ${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_REM}rem">
            ${HOURS.map(
              (hour) => html`
                <div class="hour" style="top: ${(hour - DAY_START_HOUR) * HOUR_REM}rem">
                  <span class="hour-label">${hour}:00</span>
                  <span class="hour-line"></span>
                </div>
              `,
            )}

            <div class="now" style="top: ${NOW_REM}rem"><span class="now-dot"></span></div>

            <div class="lanes">
              ${LANES.map(
                (lane) => html`
                  <div class="lane" style="flex-grow: ${lane.narrow ? 0 : 1}; min-width: ${lane.widthRem}rem">
                    ${lane.laid.map(
                      (laid) => html`
                        <div
                          class="slot"
                          data-band="${laid.band.id}"
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
  `,
  styles: css`
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
      align-items: baseline;
      gap: 2rem;
      flex: none;
      padding: 1.2rem 1.6rem;
      border-bottom: 1px solid rgb(255 255 255 / 0.06);
    }

    .mark {
      font-family: var(--k-display);
      font-size: 1.6rem;
      letter-spacing: 0.26em;
      color: var(--k-brass);
    }

    .date {
      flex: 1;
      font-size: 1.4rem;
      color: var(--k-ink);
    }

    .total {
      font-family: var(--k-mono);
      font-size: 1.3rem;
      color: var(--k-ink-2);
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

    .hour {
      position: absolute;
      right: 0;
      left: 0;
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

    .hour-line {
      height: 1px;
      flex: 1;
      background: rgb(255 255 255 / 0.05);
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
      display: flex;
    }

    .lane {
      position: relative;
      flex-basis: 0;
      border-left: 1px solid rgb(255 255 255 / 0.06);
    }

    .slot {
      position: absolute;
      padding-right: 1px;
    }

    ${KERBE_BAND_STYLES}
  `,
});
