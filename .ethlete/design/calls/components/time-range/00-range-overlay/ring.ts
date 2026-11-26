import { css } from '@design-explore';
import { ACCENT, GROUND, LINE, MUTED, PANEL, RANGE } from './fixture';

export const SIZE = 280;
export const CENTER = SIZE / 2;
const RADIUS = 112;

export const point = (hour: number, radius: number) => {
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

/** The ring with every label in `labels`, keyed by hour, and `extra` drawn above the track. */
export const ring = (labels: Record<number, string>, extra = '') => {
  const text = Object.entries(labels)
    .map(([hour, label]) => {
      const at = point(Number(hour), label.length > 2 ? 68 : 74);
      return `<text x="${at.x}" y="${at.y}">${label}</text>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
      <circle class="track" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" />
      <path class="range" d="${arc}" />
      <g class="ticks">${ticks}</g>
      <g class="labels">${text}</g>
      ${extra}
      <circle class="handle" cx="${start.x}" cy="${start.y}" r="12" />
      <circle class="handle active" cx="${end.x}" cy="${end.y}" r="12" />
      <text class="duration" x="${CENTER}" y="${CENTER - 2}">${RANGE.duration}</text>
      <text class="note" x="${CENTER}" y="${CENTER + 20}">ends next day</text>
    </svg>
  `;
};

export const ringStyles = css`
  svg {
    display: block;
    margin: 0 auto;
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
    text-anchor: middle;
    dominant-baseline: central;
    font-variant-numeric: tabular-nums;
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

  .duration {
    fill: currentColor;
    font-size: 20px;
    font-weight: 500;
    text-anchor: middle;
  }

  .note {
    fill: ${MUTED};
    font-size: 11px;
    text-anchor: middle;
  }
`;
