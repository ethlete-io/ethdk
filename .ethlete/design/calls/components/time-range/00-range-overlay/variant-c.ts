import { css, drawing, html } from '@design-explore';
import { ACCENT, GROUND, LINE, MUTED, PANEL, RANGE, frameStyles, hourLabel, trigger } from './fixture';

const at = (hour: number) => `${(hour / 24) * 100}%`;
const width = (from: number, to: number) => `${((to - from) / 24) * 100}%`;

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <div class="head">
        <span class="duration">${RANGE.duration}</span>
        <span class="note">ends next day</span>
      </div>
      <div class="track">
        <span class="range" style="left: 0; width: ${width(0, RANGE.to)}"></span>
        <span class="range" style="left: ${at(RANGE.from)}; width: ${width(RANGE.from, 24)}"></span>
        <span class="handle" style="left: ${at(RANGE.from)}"></span>
        <span class="handle active" style="left: ${at(RANGE.to)}"></span>
      </div>
      <div class="scale">
        ${[0, 6, 12, 18, 24].map((hour) => html`<span style="left: ${at(hour)}">${hourLabel(hour)}</span>`)}
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .duration {
      font-size: 2rem;
      font-weight: 500;
    }

    .note {
      font-size: 1.1rem;
      color: ${MUTED};
    }

    .track {
      position: relative;
      height: 2.8rem;
      margin: 0 1.2rem;
      border-radius: 1.4rem;
      background: ${LINE};
    }

    .range {
      position: absolute;
      top: 0;
      bottom: 0;
      background: ${ACCENT};
      opacity: 0.45;
    }

    .handle {
      position: absolute;
      top: 50%;
      width: 2.4rem;
      height: 2.4rem;
      border: 2px solid ${ACCENT};
      border-radius: 50%;
      background: ${PANEL};
      transform: translate(-50%, -50%);
    }

    .handle.active {
      border: 3px solid ${GROUND};
      background: ${ACCENT};
    }

    .scale {
      position: relative;
      height: 1.6rem;
      margin: 0.8rem 1.2rem 0;
    }

    .scale span {
      position: absolute;
      font-size: 1.1rem;
      color: ${MUTED};
      transform: translateX(-50%);
      font-variant-numeric: tabular-nums;
    }
  `,
});
