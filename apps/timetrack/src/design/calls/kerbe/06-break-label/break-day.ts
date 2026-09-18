import { css, drawing, html } from '@design-explore';
import { BandTreatment, KERBE_VARS } from '../../../kerbe';
import { KERBE_BAND_STYLES, kerbeBand } from '../../../kerbe-band.component';
import {
  BreakLabelAt,
  DAY_HEIGHT_REM,
  GUTTER_REM,
  HOURS,
  LANES,
  MARKS,
  NOW_REM,
  STORIES,
  STRIP_ROW_REM,
} from './fixture';

const TREATMENT: BandTreatment = 'inlay';

const PAUSE_VARIANTS: Partial<Record<BreakLabelAt, string>> = {
  'sign-plate': 'plate',
  'sign-cut': 'cut',
  'sign-bold': 'bold',
  'sign-shrink': 'plate',
  'sign-flat': 'plate',
};

const marksFor = (labelAt: BreakLabelAt) => {
  const named = labelAt.startsWith('named');
  const signed = labelAt.startsWith('sign');

  return MARKS.map((mark) => {
    const cellKey = labelAt === 'idle-lane' ? mark.idleLaneKey : null;

    return {
      ...mark,
      floats: labelAt === 'ground',
      inGutter: labelAt === 'gutter' || (labelAt === 'idle-lane' && !cellKey),
      bracket: labelAt === 'notch',
      glyph: labelAt === 'glyph',
      dashed: labelAt === 'hatch-rules',
      hatchGutter: labelAt === 'hatch-notch',
      hatchField: labelAt === 'hatch-day',
      blockGutter: labelAt === 'block-gutter' || labelAt === 'named-block' || signed,
      heavy: labelAt === 'heavy-rules' || named || signed,
      hatchLoud: labelAt === 'hatch-loud' || labelAt === 'named-hatch',
      word: named && labelAt !== 'named-turned',
      wordTurned: labelAt === 'named-turned',
      signPause: labelAt === 'sign-pause',
      signCup: labelAt === 'sign-cup',
      pauseVariant: PAUSE_VARIANTS[labelAt] ?? null,
      signSmall: labelAt === 'sign-shrink' && mark.short,
      signFlat: labelAt === 'sign-flat' && mark.short,
      cells: LANES.map((lane) => ({
        key: lane.key,
        widthRem: lane.widthRem,
        carriesLabel: lane.key === cellKey,
      })),
    };
  });
};

/**
 * The day with the break drawn as a frame, which calls 4 and 5 settled. Only `labelAt` changes:
 * where the break writes its own name.
 */
export const breakDay = (labelAt: BreakLabelAt) =>
  drawing({
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
              (lane) => html`<span class="head-lane" style="min-width: ${lane.widthRem}rem">${lane.label}</span>`,
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

            <div class="axis" style="height: ${DAY_HEIGHT_REM}rem">
              ${HOURS.map(
                (hour) => html`
                  <div class="hour" style="top: ${hour.topRem}rem">
                    <span class="hour-label"><span class="hour-text">${hour.hour}:00</span></span>
                    <span class="hour-line"></span>
                  </div>
                `,
              )}
              ${marksFor(labelAt).map(
                (mark) => html`
                  <div
                    class="brk ${mark.dashed && 'brk--dashed'} ${mark.heavy && 'brk--heavy'}"
                    style="top: ${mark.topRem}rem; height: ${mark.heightRem}rem"
                  >
                    ${mark.cells.map(
                      (cell) => html`
                        <span class="brk-cell" style="min-width: ${cell.widthRem}rem">
                          ${
                            cell.carriesLabel &&
                            html`<span class="brk-label brk-label--cell">Break · ${mark.minutes}m</span>`
                          }
                        </span>
                      `,
                    )}
                    ${mark.floats && html`<span class="brk-label brk-label--float">Break · ${mark.minutes}m</span>`}
                    ${mark.inGutter && html`<span class="brk-label brk-label--gutter">${mark.minutes}m</span>`}
                    ${mark.bracket && html`<span class="brk-bracket"></span>`}
                    ${mark.glyph && html`<span class="brk-glyph"></span>`}
                    ${mark.hatchGutter && html`<span class="brk-hatch brk-hatch--gutter"></span>`}
                    ${mark.hatchField && html`<span class="brk-hatch brk-hatch--field"></span>`}
                    ${mark.blockGutter && html`<span class="brk-hatch brk-hatch--block"></span>`}
                    ${
                      mark.heavy &&
                      html`<span class="brk-edge brk-edge--top"></span><span class="brk-edge brk-edge--bottom"></span>`
                    }
                    ${mark.hatchLoud && html`<span class="brk-hatch brk-hatch--loud"></span>`}
                    ${mark.word && html`<span class="brk-word">Break</span>`}
                    ${mark.wordTurned && html`<span class="brk-word brk-word--turned">Break</span>`}
                    ${mark.signPause && html`<span class="brk-sign brk-sign--pause"></span>`}
                    ${mark.signCup && html`<span class="brk-sign"><span class="brk-cup"></span></span>`}
                    ${
                      mark.pauseVariant &&
                      html`
                        <span class="brk-sign">
                          <span
                            class="brk-pause brk-pause--${mark.pauseVariant} ${mark.signSmall && 'brk-pause--small'} ${
                            mark.signFlat && 'brk-pause--flat'
                          }"
                          ></span>
                        </span>
                      `
                    }
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

      .brk-label {
        position: absolute;
        font-family: var(--k-mono);
        font-size: 1.05rem;
        letter-spacing: 0.1em;
        white-space: nowrap;
        color: var(--k-ink-3);
      }

      .brk-label--float {
        top: 0;
        left: 0.8rem;
        transform: translateY(-50%);
        padding: 0 0.6rem;
        background: var(--k-ground);
      }

      .brk-label--cell {
        top: 0.25rem;
        left: 0.8rem;
      }

      .brk-label--gutter {
        top: 0;
        left: ${-GUTTER_REM + 0.8}rem;
        width: ${GUTTER_REM - 1.6}rem;
        transform: translateY(-50%);
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .brk--dashed {
        border-top: 1px dashed rgb(140 134 118 / 0.42);
        border-bottom: 1px dashed rgb(140 134 118 / 0.42);
      }

      .brk-hatch {
        position: absolute;
        background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.24) 0 1px, transparent 1px 5px);
      }

      .brk-hatch--gutter {
        top: -1px;
        bottom: -1px;
        left: ${-GUTTER_REM}rem;
        width: 1.2rem;
        border-top: 1px solid rgb(140 134 118 / 0.26);
        border-bottom: 1px solid rgb(140 134 118 / 0.26);
      }

      .brk-hatch--field {
        inset: 0;
        background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.12) 0 1px, transparent 1px 7px);
      }

      .brk-hatch--block {
        top: -1px;
        bottom: -1px;
        left: ${-GUTTER_REM}rem;
        width: ${GUTTER_REM}rem;
        border-top: 1px solid rgb(140 134 118 / 0.26);
        border-bottom: 1px solid rgb(140 134 118 / 0.26);
        background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.3) 0 1px, transparent 1px 5px);
      }

      .brk-hatch--loud {
        inset: 0;
        background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.3) 0 2px, transparent 2px 9px);
      }

      .brk--heavy .brk-cell::before {
        position: absolute;
        top: 0;
        bottom: 0;
        left: -1px;
        width: 1px;
        background: var(--k-ground);
        content: '';
      }

      .brk-word {
        position: absolute;
        top: 0.4rem;
        left: ${-GUTTER_REM}rem;
        width: ${GUTTER_REM - 0.8}rem;
        font-family: var(--k-mono);
        font-size: 1.05rem;
        letter-spacing: 0.1em;
        text-align: right;
        text-transform: uppercase;
        white-space: nowrap;
        color: var(--k-ink-2);
      }

      .brk-word--turned {
        top: 0;
        bottom: 0;
        left: ${-GUTTER_REM + 0.2}rem;
        display: flex;
        width: auto;
        align-items: center;
        overflow: hidden;
        writing-mode: vertical-rl;
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
        gap: 0.35rem;
      }

      .brk-sign--pause::before,
      .brk-sign--pause::after {
        width: 2px;
        height: 1.1rem;
        background: var(--k-ink-2);
        content: '';
      }

      /*
       * 4px bar and 4px gap, so the width and the pitch are both whole device pixels at scale
       * 1.25, 1.5, 2 and 3. At 2px the bar is 2.5 device pixels at 1.25, the two bars land on
       * different subpixel phases, and one renders wider than the other.
       */
      .brk-pause {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .brk-pause::before,
      .brk-pause::after {
        width: 4px;
        height: 14px;
        background: var(--k-ink-2);
        content: '';
      }

      .brk-pause--plate {
        padding: 4px 6px;
        background: var(--k-ground);
      }

      .brk-pause--small {
        padding: 2px 5px;
      }

      .brk-pause--small::before,
      .brk-pause--small::after {
        height: 10px;
      }

      .brk-pause--flat {
        padding: 0;
        background: none;
      }

      .brk-pause--cut {
        gap: 0.4rem;
      }

      .brk-pause--cut::before,
      .brk-pause--cut::after {
        width: 3px;
        height: 1.3rem;
        background: var(--k-ground);
      }

      .brk-pause--bold {
        gap: 0.4rem;
      }

      .brk-pause--bold::before,
      .brk-pause--bold::after {
        width: 3px;
        height: 1.4rem;
        border-radius: 1px;
        background: var(--k-ink);
      }

      .brk-cup {
        position: relative;
        width: 1.4rem;
        height: 1rem;
        border: 1px solid var(--k-ink-2);
        border-top: 0;
        border-radius: 0 0 0.35rem 0.35rem;
      }

      .brk-cup::after {
        position: absolute;
        top: 0.1rem;
        right: -0.55rem;
        width: 0.5rem;
        height: 0.5rem;
        border: 1px solid var(--k-ink-2);
        border-left: 0;
        border-radius: 0 0.3rem 0.3rem 0;
        content: '';
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

      .brk-bracket {
        position: absolute;
        top: -1px;
        bottom: -1px;
        left: ${-GUTTER_REM}rem;
        width: 1.2rem;
        border: 1px solid rgb(140 134 118 / 0.26);
        border-right: 0;
      }

      .brk-glyph {
        position: absolute;
        top: 50%;
        left: ${-GUTTER_REM}rem;
        display: flex;
        width: 1.2rem;
        justify-content: center;
        gap: 0.3rem;
        transform: translateY(-50%);
      }

      .brk-glyph::before,
      .brk-glyph::after {
        width: 1px;
        height: 0.9rem;
        background: var(--k-ink-3);
        content: '';
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
    `,
  });
