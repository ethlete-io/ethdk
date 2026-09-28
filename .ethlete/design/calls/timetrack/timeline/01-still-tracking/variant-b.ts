import { css, drawing, html } from '@design-explore';
import { duration, NOW_MIN, remAt, remFor, ROW } from './fixture';
import { band, LANE_STYLES, stillTrackingLanes } from './lane';

const tailMinutes = NOW_MIN - ROW.meetingEndMin;
const GAP_REM = 0.3;

export default drawing({
  body: stillTrackingLanes({
    growing: {
      hint: 'a live rail',
      body: html`
        ${band({
          tone: 'brand',
          fromMin: ROW.fromMin,
          toMin: ROW.meetingEndMin,
          label: `${ROW.ticket} · ${duration(NOW_MIN - ROW.fromMin)}`,
          detail: ROW.detail,
        })}
        <div
          class="et-color--brand rail-run"
          style="top: ${remAt(ROW.meetingEndMin) + GAP_REM}rem; height: ${remFor(tailMinutes) - GAP_REM}rem"
        >
          <span class="rail live"></span>
          <span class="rail-label">+${duration(tailMinutes)} live</span>
          <button class="chip rail-cut" type="button" title="Stop ${ROW.ticket} at the end of the meeting">×</button>
        </div>
      `,
    },
    snipped: {
      hint: 'rest is its own band',
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
        <button
          class="et-color--brand chip restore"
          style="top: ${remAt(ROW.meetingEndMin) - 0.3}rem"
          type="button"
          title="Let ${ROW.ticket} follow the call again"
        >
          ↺ +${duration(tailMinutes)}
        </button>
      `,
    },
  }),
  styles:
    LANE_STYLES +
    css`
      .rail-run {
        position: absolute;
        inset-inline: 0;
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }

      .rail {
        align-self: stretch;
        width: 0.4rem;
        border-radius: 999px;
        background: rgb(var(--et-color-primary));
      }

      .rail-label {
        font-family: ui-monospace, monospace;
        font-size: 1.2rem;
        color: rgb(var(--et-color-primary-ink));
      }

      .rail-cut {
        position: static;
        margin-left: auto;
        margin-right: 0.4rem;
      }

      .restore {
        right: 0.4rem;
        transform: translateY(-100%);
      }
    `,
});
