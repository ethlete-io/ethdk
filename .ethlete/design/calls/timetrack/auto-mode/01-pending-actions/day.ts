import { css, html } from '@design-explore';
import { clock, DAY_LABEL, HOUR_REM, NOW_MIN, remAt, WINDOW_MINUTES } from './fixture';

const HOURS = [14 * 60, 15 * 60, 16 * 60];

const lane = (options: { label: string; body: string; extraClass?: string }) => html`
  <div class="lane-col ${options.extraClass ?? ''}">
    <div class="lane-head">${options.label}</div>
    <div class="lane" style="height: ${(WINDOW_MINUTES / 60) * HOUR_REM}rem">${options.body}</div>
  </div>
`;

/** The afternoon slice of the day view: its header, then the hour axis and the lanes. */
export const dayView = (options: {
  headerSide?: string;
  underHeader?: string;
  code: string;
  calls: string;
  autoLane?: string;
}) => html`
  <div class="et-surface--dark sheet">
    <div class="day-header">
      <span class="day-title">${DAY_LABEL}</span>
      <span class="day-total muted">3h 0m booked</span>
      <span class="day-side">${options.headerSide ?? ''}</span>
    </div>
    ${options.underHeader ?? ''}
    <div class="timeline">
      <div class="axis">
        <div class="lane-head axis-head"></div>
        <div class="axis-body" style="height: ${(WINDOW_MINUTES / 60) * HOUR_REM}rem">
          ${HOURS.map(
            (minute) => html`<span class="hour-label" style="top: ${remAt(minute)}rem">${clock(minute)}</span>`,
          )}
        </div>
      </div>
      <div class="lanes">
        <div class="rules">
          ${HOURS.map((minute) => html`<span class="hour-rule" style="top: ${remAt(minute)}rem"></span>`)}
          <div class="now" style="top: ${remAt(NOW_MIN)}rem"><span class="now-dot"></span></div>
        </div>
        ${lane({ label: 'Code', body: options.code, extraClass: 'lane-code' })}
        ${lane({ label: 'Calls &amp; meetings', body: options.calls, extraClass: 'lane-calls' })}
        ${options.autoLane && lane({ label: 'Auto mode', body: options.autoLane, extraClass: 'et-color--brand lane-auto' })}
      </div>
    </div>
  </div>
`;

/** The day timeline's own band, positioned in its lane by clock minutes. */
export const band = (options: {
  tone: string;
  fromMin: number;
  toMin: number;
  label: string;
  detail?: string;
  extraClass?: string;
  attrs?: string;
  inner?: string;
}) => {
  const heightRem = ((options.toMin - options.fromMin) / 60) * HOUR_REM;
  const compact = heightRem < 2.2;

  return html`
    <div
      class="et-color--${options.tone} band ${options.extraClass ?? ''}"
      style="top: ${remAt(options.fromMin)}rem; height: ${heightRem}rem"
      ${compact && 'data-compact'}
      ${options.attrs ?? ''}
      role="button"
      tabindex="0"
    >
      <span class="band-line">${options.label}</span>
      ${heightRem >= 4 && options.detail && html`<span class="band-line band-detail">${options.detail}</span>`}
      ${options.inner ?? ''}
    </div>
  `;
};

export const DAY_STYLES = css`
  /* The frame runs without the surface directive, so the value the dark theme sets at runtime is written here. */
  #root {
    --et-surface-tint: rgb(161 161 161);
    --et-surface-control-text: rgb(161 161 161);
  }

  .sheet {
    display: flex;
    flex-direction: column;
    gap: 1.6rem;
    min-height: 100vh;
    padding: 2.4rem 3rem 3rem;
    background: var(--et-surface-background);
    color: var(--et-surface-text);
    font-size: var(--text-small);
    line-height: var(--text-small--line-height);
  }

  .day-header {
    display: flex;
    align-items: baseline;
    gap: 1.2rem;
  }

  .day-title {
    font-size: var(--text-h4);
    line-height: var(--text-h4--line-height);
  }

  .day-side {
    margin-left: auto;
  }

  .muted {
    color: var(--et-surface-text-muted);
  }

  .subtle {
    color: var(--et-surface-text-subtle);
  }

  .mono {
    font-family: ui-monospace, monospace;
  }

  .timeline {
    display: flex;
  }

  .axis {
    width: 7.6rem;
    flex-shrink: 0;
  }

  .axis-body {
    position: relative;
  }

  .hour-label {
    position: absolute;
    right: 0.8rem;
    transform: translateY(-50%);
    font-family: ui-monospace, monospace;
    font-size: 1.2rem;
    color: var(--et-surface-text-subtle);
    white-space: nowrap;
  }

  .lanes {
    position: relative;
    display: flex;
  }

  .rules {
    pointer-events: none;
    position: absolute;
    inset: 2.9rem 0 0;
  }

  .hour-rule {
    position: absolute;
    inset-inline: 0;
    height: 1px;
    background: var(--et-surface-border);
  }

  .now {
    position: absolute;
    inset-inline: 0;
    z-index: 10;
    border-top: 2px solid var(--color-et-tone-brand-text);
  }

  .now-dot {
    position: absolute;
    top: -0.5rem;
    left: -0.4rem;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 999px;
    background: var(--color-et-tone-brand-text);
  }

  .lane-col {
    display: flex;
    flex-direction: column;
  }

  .lane-code {
    width: 26rem;
  }

  .lane-calls {
    width: 20rem;
  }

  .lane-auto {
    width: 24rem;
  }

  .lane-head {
    height: 2.9rem;
    padding: 0.4rem 0.8rem;
    border-bottom: 1px solid var(--et-surface-border);
    border-left: 1px solid var(--et-surface-border);
    color: var(--et-surface-text-muted);
    white-space: nowrap;
  }

  .axis-head {
    border-left: none;
  }

  .lane {
    position: relative;
    border-left: 1px solid var(--et-surface-border);
  }

  .band {
    position: absolute;
    inset-inline: 0.2rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0.4rem 0.8rem;
    border-left: 2px solid var(--et-tone-fill-rest);
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--et-tone-fill-rest) 15%, transparent);
    cursor: grab;
    outline: none;
  }

  .band:hover {
    background: color-mix(in srgb, var(--et-tone-fill-rest) 30%, transparent);
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
    color: var(--et-surface-text-muted);
  }

  .icon-button {
    display: inline-grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    flex-shrink: 0;
    border: 1px solid var(--et-surface-border);
    border-radius: 0.3rem;
    background: var(--et-surface-background);
    color: var(--et-surface-text);
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .icon-button:hover {
    border-color: var(--et-tone-text-rest);
  }

  .icon-button[data-approve] {
    border-color: var(--et-tone-text-rest);
    color: var(--color-et-tone-brand-text);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.2rem 1rem;
    border: 1px solid color-mix(in srgb, var(--et-tone-text-rest) 60%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--et-tone-fill-rest) 15%, transparent);
    color: var(--color-et-tone-brand-text);
    white-space: nowrap;
    cursor: pointer;
  }

  .pill-dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    background: var(--color-et-tone-brand-text);
  }

  .one-by-one {
    padding: 0 0.6rem;
    border-radius: 0.2rem;
    background: color-mix(in srgb, var(--et-tone-fill-rest) 15%, transparent);
    color: var(--et-tone-text-rest);
    font-size: 1.2rem;
    white-space: nowrap;
  }
`;
