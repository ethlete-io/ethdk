import { css, html } from '@design-explore';

/** The overnight range of call 00, with the "to" field focused, on a phone. */
export const RANGE = { from: 22, to: 6.5, fromLabel: '22:00', toLabel: '06:30', duration: '8 h 30 min' };

export const GROUND = '#14161a';
export const PANEL = '#1d2026';
export const LINE = '#2e323a';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8fa8ff';
export const ACCENT_SOFT = 'rgba(143, 168, 255, 0.22)';

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

/**
 * The range ring of call 00, drawn `width` px wide. `handle` is the handle radius in ring
 * units; `activeEnd` fills only the "to" handle, otherwise both handles are filled.
 */
export const ring = (width: number, handle: number, activeEnd: boolean) => `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${width}" height="${width}">
    <circle class="track" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" />
    <path class="range" d="${arc}" />
    <g class="ticks">${ticks}</g>
    <g class="labels">${labels}</g>
    <circle class="handle ${activeEnd ? '' : 'active'}" cx="${start.x}" cy="${start.y}" r="${handle}" />
    <circle class="handle active" cx="${end.x}" cy="${end.y}" r="${handle}" />
    <text class="duration" x="${CENTER}" y="${CENTER - 2}">${RANGE.duration}</text>
    <text class="note" x="${CENTER}" y="${CENTER + 20}">ends next day</text>
  </svg>
`;

export const trigger = html`
  <div class="trigger">
    <span class="field">${RANGE.fromLabel}</span>
    <span class="dash">–</span>
    <span class="field active">${RANGE.toLabel}</span>
  </div>
`;

export const frameStyles = css`
  html {
    font-size: 62.5%;
    background: ${GROUND};
  }

  #root {
    position: relative;
    display: block;
    box-sizing: border-box;
    height: 64rem;
    padding: 1.6rem;
    overflow: hidden;
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
    width: 3.6rem;
    height: 0.4rem;
    margin: 0 auto 1.6rem;
    border-radius: 0.2rem;
    background: ${LINE};
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

  svg text.note {
    fill: ${MUTED};
    font-size: 11px;
  }
`;
