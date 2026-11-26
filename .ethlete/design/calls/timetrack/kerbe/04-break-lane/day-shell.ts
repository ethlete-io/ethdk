import { css, html } from '@design-explore';
import { BandTreatment, KERBE_VARS } from '../../shared/kerbe';
import { KERBE_BAND_STYLES, kerbeBand } from '../../shared/kerbe-band.component';
import { BreakMode, DAY_BY_MODE, GUTTER_REM, STORIES, STRIP_ROW_REM } from './fixture';

const TREATMENT: BandTreatment = 'inlay';

/**
 * The whole day at the window's own geometry, drawn once so every option of this call shares it.
 * Only `mode` changes, and it changes where a break goes and nothing else.
 */
export const breakDay = ({ mode }: { mode: BreakMode }) => {
  const day = DAY_BY_MODE[mode];

  return html`
    <div class="window" data-mode="${mode}">
      <div class="chrome">
        <span class="mark">KERBE</span>
        <span class="date">Tuesday, 16 September</span>
        <span class="total">7h 15m</span>
      </div>

      <div class="timeline">
        <div class="head">
          <span class="head-gutter"></span>
          ${day.lanes.map(
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

          <div class="axis" style="height: ${day.heightRem}rem">
            ${day.hours.map(
              (hour) => html`
                <div class="hour" style="top: ${hour.topRem}rem">
                  <span class="hour-label">${hour.hour}:00</span>
                  <span class="hour-line"></span>
                </div>
              `,
            )}
            ${day.marks.map(
              (mark) => html`
                <div class="brk" style="top: ${mark.topRem}rem; height: ${mark.heightRem}rem">
                  <span class="brk-label">
                    ${mode === 'rule' && html`<span class="brk-word">${mark.label}</span>`}
                    <span class="brk-time">${mark.minutes}m</span>
                  </span>
                  <span class="brk-body"></span>
                </div>
              `,
            )}

            <div class="now" style="top: ${day.nowRem}rem"><span class="now-dot"></span></div>

            <div class="lanes">
              ${day.lanes.map(
                (lane) => html`
                  <div class="lane" style="flex-grow: ${lane.narrow ? 0 : 1}; min-width: ${lane.widthRem}rem">
                    ${lane.laid.map(
                      (laid) => html`
                        <div
                          class="slot"
                          style="top: ${laid.topRem}rem; left: ${laid.inlineOffset}%; width: ${laid.inlineSize}%"
                        >
                          ${kerbeBand({ band: laid.band, narrow: lane.narrowMode, treatment: TREATMENT })}
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
};

/** The styles `breakDay` needs, for a drawing to include in its own `styles`. */
export const BREAK_DAY_STYLES = css`
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

  .brk {
    position: absolute;
    right: 0;
    left: 0;
    display: flex;
  }

  .brk-label {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    width: ${GUTTER_REM - 0.8}rem;
    flex: none;
    padding-top: 0.2rem;
    align-self: flex-start;
    font-family: var(--k-mono);
    font-size: 1.05rem;
    color: var(--k-ink-3);
  }

  .brk-word {
    font-family: var(--k-sans);
    font-size: 1.15rem;
    color: var(--k-ink-2);
  }

  .brk-body {
    flex: 1;
    margin-left: 0.8rem;
  }

  .window[data-mode='rule'] .brk-body {
    border-top: 1px solid rgb(140 134 118 / 0.26);
    border-bottom: 1px solid rgb(140 134 118 / 0.26);
    background: rgb(255 255 255 / 0.02);
  }

  .window[data-mode='gutter'] .brk {
    width: ${GUTTER_REM}rem;
    right: auto;
  }

  .window[data-mode='gutter'] .brk-label {
    align-self: stretch;
    align-items: flex-start;
    border-right: 3px solid rgb(140 134 118 / 0.34);
    padding-right: 0.6rem;
  }

  .window[data-mode='gutter'] .brk-body {
    display: none;
  }

  .window[data-mode='collapse'] .brk-label {
    transform: translateY(-50%);
    padding-top: 0;
  }

  .window[data-mode='collapse'] .brk-body {
    align-self: center;
    height: 1px;
    background: repeating-linear-gradient(90deg, rgb(140 134 118 / 0.4) 0 4px, transparent 4px 8px);
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
`;
