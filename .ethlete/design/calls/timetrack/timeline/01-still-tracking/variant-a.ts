import { css, drawing, html } from '@design-explore';
import { clock, duration, NOW_MIN, remAt, remFor, ROW } from './fixture';
import { band, LANE_STYLES, stillTrackingLanes } from './lane';

const tailMinutes = NOW_MIN - ROW.meetingEndMin;

export default drawing({
  body: stillTrackingLanes({
    growing: {
      hint: 'the tail breathes',
      body: band({
        tone: 'brand',
        fromMin: ROW.fromMin,
        toMin: NOW_MIN,
        label: `${ROW.ticket} · ${duration(NOW_MIN - ROW.fromMin)}`,
        detail: ROW.detail,
        inner: html`
          <span class="tail live" style="height: ${remFor(tailMinutes)}rem"></span>
          <button
            class="chip snip"
            style="top: ${remFor(ROW.meetingEndMin - ROW.fromMin)}rem"
            type="button"
            title="End the row at ${clock(ROW.meetingEndMin)}"
          >
            ✂ ${clock(ROW.meetingEndMin)}
          </button>
        `,
      }),
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
          style="top: ${remAt(ROW.meetingEndMin)}rem"
          type="button"
          title="Let ${ROW.ticket} follow the call again"
        >
          ↺ follow
        </button>
      `,
    },
  }),
  styles:
    LANE_STYLES +
    css`
      .tail {
        pointer-events: none;
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        border-top: 1px dashed rgb(var(--et-color-primary-ink));
        background: repeating-linear-gradient(
          -45deg,
          transparent 0,
          transparent 4px,
          rgb(var(--et-color-primary) / 0.35) 4px,
          rgb(var(--et-color-primary) / 0.35) 6px
        );
      }

      .snip {
        right: 0.4rem;
        transform: translateY(-50%);
      }

      .restore {
        right: 0.4rem;
        transform: translateY(calc(-100% - 0.3rem));
      }
    `,
});
