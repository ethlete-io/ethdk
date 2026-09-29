import { css, html } from '@design-explore';

/** The range of call 05 on a 360px phone: Fri 2 Oct 22:00 to Sun 4 Oct 06:30, the end last moved. */
export const RANGE = {
  from: 22,
  to: 6.5,
  fromDay: 2,
  toDay: 4,
  fromLabel: 'Fri 2 Oct, 22:00',
  toLabel: 'Sun 4 Oct, 06:30',
  duration: '32 h 30 min',
  note: 'ends Sun 4 Oct',
};

export type Range = typeof RANGE;

export const GROUND = '#14161a';
export const PANEL = '#1d2026';
export const LINE = '#2e323a';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8fa8ff';
export const ACCENT_SOFT = 'rgba(143, 168, 255, 0.22)';
export const ACCENT_INK = '#14161a';

export const SIZE = 280;
export const CENTER = SIZE / 2;
const RADIUS = 112;

const pad = (value: number) => String(value).padStart(2, '0');

const point = (hour: number, radius: number) => {
  const angle = ((hour / 24) * 360 - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
};

const span = (RANGE.to - RANGE.from + 24) % 24;
const start = point(RANGE.from, RADIUS);
const end = point(RANGE.to, RADIUS);
const arc = `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${span > 12 ? 1 : 0} 1 ${end.x} ${end.y}`;

const ticks = Array.from({ length: 24 }, (_, hour) => {
  const outer = point(hour, 94);
  const inner = point(hour, hour % 3 === 0 ? 88 : 91);
  return `<line x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" />`;
}).join('');

const labels = [0, 3, 6, 9, 12, 15, 18, 21]
  .map((hour) => {
    const at = point(hour, 74);
    return `<text x="${at.x}" y="${at.y}">${pad(hour)}</text>`;
  })
  .join('');

/** The touch ring of call 04 C: 328px, 44px handles, both filled, the centre of call 05 E. */
export const ring = (width = 328) => `
  <svg class="ring" viewBox="0 0 ${SIZE} ${SIZE}" width="${width}" height="${width}">
    <circle class="track" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" />
    <path class="range" d="${arc}" />
    <g class="ticks">${ticks}</g>
    <g class="labels">${labels}</g>
    <circle class="handle active" cx="${start.x}" cy="${start.y}" r="${(22 * SIZE) / width}" />
    <circle class="handle active" cx="${end.x}" cy="${end.y}" r="${(22 * SIZE) / width}" />
    <text class="big" x="${CENTER}" y="${CENTER - 4}">06:30</text>
    <text class="note" x="${CENTER}" y="${CENTER + 20}">Sun 4 Oct</text>
  </svg>
`;

/** October 2026 from Monday 28 Sep, five weeks, with the range days marked. */
const days = (range: Range) =>
  Array.from({ length: 35 }, (_, index) => {
    const day = index - 2;
    const inMonth = day >= 1 && day <= 31;
    const label = inMonth ? day : day < 1 ? 30 + day : day - 31;
    const edge = inMonth && (day === range.fromDay || day === range.toDay);
    const inside = inMonth && day > range.fromDay && day < range.toDay;
    const classes = ['day', inMonth ? '' : 'outside', edge ? 'edge' : '', inside ? 'inside' : ''];
    if (day === range.fromDay) classes.push('first');
    if (day === range.toDay) classes.push('last');
    return `<span class="${classes.join(' ').trim()}">${label}</span>`;
  }).join('');

export const calendar = (range: Range = RANGE) => `
  <div class="calendar">
    <div class="month">
      <span class="arrow">‹</span>
      <span>October 2026</span>
      <span class="arrow">›</span>
    </div>
    <div class="weekdays">
      <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
    </div>
    <div class="days">${days(range)}</div>
  </div>
`;

export const triggerFor = (range: Range) => html`
  <div class="trigger">
    <span class="field">${range.fromLabel}</span>
    <span class="dash">–</span>
    <span class="field active">${range.toLabel}</span>
  </div>
`;

export const trigger = triggerFor(RANGE);

export const frameStyles = css`
  html {
    font-size: 62.5%;
    background: ${GROUND};
  }

  #root {
    position: relative;
    display: block;
    box-sizing: border-box;
    height: 74rem;
    overflow: hidden;
    padding: 1.6rem;
    background: ${GROUND};
    font-family: system-ui, sans-serif;
    color: ${INK};
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 1.2rem;
    border: 1px solid ${LINE};
    border-radius: 0.8rem;
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
  }

  .field {
    padding-bottom: 0.2rem;
    border-bottom: 2px solid transparent;
  }

  .field.active {
    border-bottom-color: ${ACCENT};
  }

  .dash {
    color: ${MUTED};
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .sheet {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 0.8rem 1.6rem 2.4rem;
    border-radius: 1.6rem 1.6rem 0 0;
    background: ${PANEL};
  }

  .grab {
    width: 3.2rem;
    height: 0.4rem;
    margin: 0 auto 1.2rem;
    border-radius: 0.2rem;
    background: ${LINE};
  }

  .calendar {
    width: 30.8rem;
    margin: 0 auto;
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
  }

  .month {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 4rem;
    font-weight: 500;
  }

  .arrow {
    width: 4rem;
    color: ${MUTED};
    font-size: 2rem;
    text-align: center;
  }

  .weekdays,
  .days {
    display: grid;
    grid-template-columns: repeat(7, 4.4rem);
  }

  .weekdays span {
    height: 2.4rem;
    color: ${MUTED};
    font-size: 1.2rem;
    text-align: center;
  }

  .day {
    display: grid;
    place-items: center;
    height: 4.4rem;
  }

  .day.outside {
    color: ${MUTED};
    opacity: 0.5;
  }

  .day.inside {
    background: ${ACCENT_SOFT};
  }

  .day.edge {
    background: radial-gradient(circle, ${ACCENT} 2.2rem, transparent 2.2rem);
    color: ${ACCENT_INK};
    font-weight: 600;
  }

  .day.first {
    background:
      radial-gradient(circle, ${ACCENT} 2.2rem, transparent 2.2rem),
      linear-gradient(to right, transparent 50%, ${ACCENT_SOFT} 50%);
  }

  .day.last {
    background:
      radial-gradient(circle, ${ACCENT} 2.2rem, transparent 2.2rem),
      linear-gradient(to left, transparent 50%, ${ACCENT_SOFT} 50%);
  }

  svg {
    display: block;
    margin: 0 auto;
  }

  svg text {
    text-anchor: middle;
    dominant-baseline: central;
    font-variant-numeric: tabular-nums;
  }

  .track {
    fill: none;
    stroke: ${LINE};
    stroke-width: 28;
  }

  .range {
    fill: none;
    stroke: ${ACCENT};
    stroke-width: 28;
    opacity: 0.45;
  }

  .ticks line {
    stroke: ${MUTED};
    stroke-width: 1;
  }

  .labels text {
    fill: ${MUTED};
    font-size: 11px;
  }

  .handle {
    fill: ${PANEL};
    stroke: ${ACCENT};
    stroke-width: 2;
  }

  .handle.active {
    fill: ${ACCENT};
    stroke: ${GROUND};
    stroke-width: 3;
  }

  svg text.duration {
    fill: ${INK};
    font-size: 20px;
    font-weight: 500;
  }

  svg text.big {
    fill: ${INK};
    font-size: 28px;
    font-weight: 500;
  }

  svg text.note {
    fill: ${MUTED};
    font-size: 11px;
  }
`;
