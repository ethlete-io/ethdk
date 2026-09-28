import { css, drawing, html } from '@design-explore';
import { clock, duration, NOW_MIN, remAt, ROW } from './fixture';
import { band, LANE_STYLES, stillTrackingLanes } from './lane';

const tailMinutes = NOW_MIN - ROW.meetingEndMin;
const joinPercent = ((ROW.meetingEndMin - ROW.fromMin) / (NOW_MIN - ROW.fromMin)) * 100;

export default drawing({
  body: stillTrackingLanes({
    growing: {
      hint: 'the tail fades',
      body: html`
        ${band({
          tone: 'brand',
          fromMin: ROW.fromMin,
          toMin: NOW_MIN,
          label: `${ROW.ticket} · ${duration(NOW_MIN - ROW.fromMin)}`,
          detail: ROW.detail,
          extraClass: 'fading',
        })}
        <div
          class="et-color--brand cut"
          style="top: ${remAt(ROW.meetingEndMin)}rem"
          title="Press to end here, drag to move"
        >
          <span class="cut-line"></span>
          <span class="chip cut-nub">✂ ${clock(ROW.meetingEndMin)}</span>
        </div>
      `,
    },
    snipped: {
      hint: 'a seam stays',
      body: html`
        ${band({
          tone: 'brand',
          fromMin: ROW.fromMin,
          toMin: ROW.meetingEndMin,
          label: `${ROW.ticket} · ${duration(ROW.meetingEndMin - ROW.fromMin)}`,
          detail: ROW.detail,
        })}
        ${band({
          tone: 'warning',
          fromMin: ROW.meetingEndMin,
          toMin: NOW_MIN,
          label: `Not yet named · ${duration(tailMinutes)}`,
        })}
        <div class="et-color--brand cut cut--done" style="top: ${remAt(ROW.meetingEndMin)}rem">
          <span class="cut-line"></span>
          <button class="chip cut-nub" type="button" title="Let ${ROW.ticket} follow the call again">↺ follow</button>
        </div>
      `,
    },
  }),
  styles:
    LANE_STYLES +
    css`
      .fading {
        border-left-color: transparent;
        background: linear-gradient(
          to bottom,
          rgb(var(--et-color-primary) / 0.15) 0 ${joinPercent}%,
          rgb(var(--et-color-primary) / 0) 100%
        );
      }

      .fading::before {
        content: '';
        position: absolute;
        inset-block: 0;
        left: -2px;
        width: 2px;
        background: linear-gradient(
          to bottom,
          rgb(var(--et-color-primary)) 0 ${joinPercent}%,
          rgb(var(--et-color-primary) / 0) 100%
        );
      }

      .cut {
        position: absolute;
        inset-inline: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        height: 0.8rem;
        margin-top: -0.4rem;
        cursor: ns-resize;
      }

      .cut-line {
        flex-grow: 1;
        border-top: 1px dashed rgb(var(--et-color-primary-ink));
      }

      .cut--done .cut-line {
        opacity: 0.5;
      }

      .cut-nub {
        position: static;
        margin-right: 0.4rem;
      }

      .cut--done .cut-nub {
        transform: translateY(calc(-50% - 0.5rem));
      }
    `,
});
