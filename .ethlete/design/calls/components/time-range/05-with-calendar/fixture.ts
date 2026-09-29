import { css, html } from '@design-explore';

/** A range over two nights, Fri 2 Oct 22:00 to Sun 4 Oct 06:30, with the "to" field focused. */
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

/** Round 2: the same times over two weeks, Fri 2 Oct 22:00 to Fri 16 Oct 06:30. */
export const LONG_RANGE = {
  ...RANGE,
  toDay: 16,
  toLabel: 'Fri 16 Oct, 06:30',
  duration: '320 h 30 min',
  note: 'ends Fri 16 Oct',
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

const durationCentre = (range: Range) => `
  <text class="duration" x="${CENTER}" y="${CENTER - 2}">${range.duration}</text>
  <text class="note" x="${CENTER}" y="${CENTER + 20}">${range.note}</text>
`;

/** The range ring of call 00 at 280px, the "to" handle active; `centre` is drawn in the middle. */
export const ring = (range: Range = RANGE, centre = durationCentre(range)) => `
  <svg class="ring" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
    <circle class="track" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" />
    <path class="range" d="${arc}" />
    <g class="ticks">${ticks}</g>
    <g class="labels">${labels}</g>
    <circle class="handle" cx="${start.x}" cy="${start.y}" r="12" />
    <circle class="handle active" cx="${end.x}" cy="${end.y}" r="12" />
    ${centre}
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
    display: block;
    min-height: 48rem;
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

  .panel {
    display: flex;
    width: max-content;
    margin-top: 0.4rem;
    padding: 1.2rem;
    border: 1px solid ${LINE};
    border-radius: 1rem;
    background: ${PANEL};
    box-shadow: 0 1.2rem 3.2rem rgba(0, 0, 0, 0.4);
  }

  .calendar {
    width: 28rem;
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
    grid-template-columns: repeat(7, 4rem);
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
    height: 4rem;
  }

  .day.outside {
    color: ${MUTED};
    opacity: 0.5;
  }

  .day.inside {
    background: ${ACCENT_SOFT};
  }

  .day.edge {
    background: radial-gradient(circle, ${ACCENT} 2rem, transparent 2rem);
    color: ${ACCENT_INK};
    font-weight: 600;
  }

  .day.first {
    background:
      radial-gradient(circle, ${ACCENT} 2rem, transparent 2rem),
      linear-gradient(to right, transparent 50%, ${ACCENT_SOFT} 50%);
  }

  .day.last {
    background:
      radial-gradient(circle, ${ACCENT} 2rem, transparent 2rem),
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
