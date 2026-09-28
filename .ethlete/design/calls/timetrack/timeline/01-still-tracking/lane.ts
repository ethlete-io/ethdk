import { css, html } from '@design-explore';
import { clock, HOUR_REM, NOW_MIN, remAt, WINDOW_MINUTES } from './fixture';

export type LaneState = 'growing' | 'snipped';

const HOURS = [14 * 60, 15 * 60];

const panel = ({ state, title, body }: { state: LaneState; title: string; body: string }) => html`
  <div class="panel">
    <div class="panel-title">
      <span>${state}</span>
      <span class="panel-hint">${title}</span>
    </div>
    <div class="lane-head">Calls &amp; meetings</div>
    <div class="day" style="height: ${(WINDOW_MINUTES / 60) * HOUR_REM}rem">
      ${HOURS.map(
        (minute) => html`
          <div class="hour" style="top: ${remAt(minute)}rem">
            <span class="hour-label">${clock(minute)}</span>
            <span class="hour-rule"></span>
          </div>
        `,
      )}
      <div class="lane">${body}</div>
      <div class="now" style="top: ${remAt(NOW_MIN)}rem"><span class="now-dot"></span></div>
    </div>
  </div>
`;

/** The two states of one variant side by side, on the same slice of the day timeline. */
export const stillTrackingLanes = (options: {
  growing: { hint: string; body: string };
  snipped: { hint: string; body: string };
}) => html`
  <div class="et-surface--dark sheet">
    ${panel({ state: 'growing', title: options.growing.hint, body: options.growing.body })}
    ${panel({ state: 'snipped', title: options.snipped.hint, body: options.snipped.body })}
  </div>
`;

/** The day timeline's own band, positioned in the lane by clock minutes. */
export const band = (options: {
  tone: string;
  fromMin: number;
  toMin: number;
  label: string;
  detail?: string;
  extraClass?: string;
  inner?: string;
}) => {
  const heightRem = ((options.toMin - options.fromMin) / 60) * HOUR_REM;
  const compact = heightRem < 2.2;

  return html`
    <div
      class="et-color--${options.tone} band ${options.extraClass ?? ''}"
      style="top: ${remAt(options.fromMin)}rem; height: ${heightRem}rem"
      ${compact && 'data-compact'}
      role="button"
      tabindex="0"
    >
      ${options.inner ?? ''}
      <span class="band-line">${options.label}</span>
      ${heightRem >= 5 && options.detail && html`<span class="band-line band-detail">${options.detail}</span>`}
    </div>
  `;
};

export const LANE_STYLES = css`
  /* The frame runs without the surface directive, so the value the dark theme sets at runtime is written here. */
  #root {
    --et-surface-interaction: 161 161 161;
  }

  .sheet {
    display: flex;
    gap: 3rem;
    padding: 3rem;
    background: rgb(var(--et-surface-background));
    color: rgb(var(--et-surface-color));
    font-size: var(--text-small);
    line-height: var(--text-small--line-height);
  }

  .panel {
    display: flex;
    flex-direction: column;
    width: 26rem;
  }

  .panel-title {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.2rem;
    font-family: ui-monospace, monospace;
  }

  .panel-hint {
    color: rgb(var(--et-surface-color-subtle));
  }

  .lane-head {
    margin-left: 5.2rem;
    padding: 0.4rem 0.8rem;
    border-bottom: 1px solid rgb(var(--et-surface-border));
    border-left: 1px solid rgb(var(--et-surface-border));
    color: rgb(var(--et-surface-color-muted));
  }

  .day {
    position: relative;
  }

  .hour {
    position: absolute;
    inset-inline: 0;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    transform: translateY(-50%);
  }

  .hour-label {
    width: 4.4rem;
    text-align: right;
    font-family: ui-monospace, monospace;
    color: rgb(var(--et-surface-color-subtle));
  }

  .hour-rule {
    height: 1px;
    flex-grow: 1;
    background: rgb(var(--et-surface-border));
  }

  .lane {
    position: absolute;
    inset-block: 0;
    left: 5.2rem;
    right: 0;
    border-left: 1px solid rgb(var(--et-surface-border));
  }

  .now {
    pointer-events: none;
    position: absolute;
    left: 5.2rem;
    right: 0;
    z-index: 10;
    border-top: 2px solid var(--color-et-brand-ink);
  }

  .now-dot {
    position: absolute;
    top: -0.5rem;
    left: -0.4rem;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 999px;
    background: var(--color-et-brand-ink);
  }

  .band {
    position: absolute;
    inset-inline: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0.4rem 0.8rem;
    border-left: 2px solid rgb(var(--et-color-primary));
    border-radius: 0.25rem;
    background: rgb(var(--et-color-primary) / 0.15);
    cursor: grab;
    outline: none;
  }

  .band:hover {
    background: rgb(var(--et-color-primary) / 0.3);
  }

  .band[data-compact] {
    padding-block: 0;
    line-height: 1;
    justify-content: center;
  }

  .band-line {
    position: relative;
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .band-detail {
    color: rgb(var(--et-surface-color-muted));
  }

  .muted {
    color: rgb(var(--et-surface-color-muted));
  }

  .chip {
    position: absolute;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.6rem;
    border: 1px solid rgb(var(--et-surface-border));
    border-radius: 0.25rem;
    background: rgb(var(--et-surface-background));
    color: rgb(var(--et-surface-color-muted));
    font-family: ui-monospace, monospace;
    font-size: 1.2rem;
    line-height: 1.8rem;
    white-space: nowrap;
    cursor: pointer;
  }

  .chip:hover {
    color: rgb(var(--et-surface-color));
    border-color: rgb(var(--et-color-primary-ink));
  }

  @keyframes live-breathe {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.45;
    }
  }

  .live {
    animation: live-breathe 2.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .live {
      animation: none;
    }
  }
`;
