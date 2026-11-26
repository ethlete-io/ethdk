import { css, html } from '@design-explore';

/** One time, 14:30, the same in every frame. */
export const VALUE = { hour: 14, minute: 30, label: '14:30' };

export const GROUND = '#14161a';
export const PANEL = '#1d2026';
export const LINE = '#2e323a';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8fa8ff';
export const ACCENT_SOFT = 'rgba(143, 168, 255, 0.22)';

export const SIZE = 280;
export const CENTER = SIZE / 2;

export const pad = (value: number) => String(value).padStart(2, '0');

/** A point on a dial of `steps` positions, step 0 at the top. */
export const point = (step: number, steps: number, radius: number) => {
  const angle = ((step / steps) * 360 - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
};

export const trigger = html`
  <div class="trigger">
    <span class="field active">${VALUE.label}</span>
  </div>
`;

export const frameStyles = css`
  html {
    font-size: 62.5%;
    background: ${GROUND};
  }

  #root {
    display: block;
    padding: 1.6rem;
    min-height: 52rem;
    background: ${GROUND};
    font-family: system-ui, sans-serif;
    color: ${INK};
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
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

  .panel {
    margin-top: 0.8rem;
    box-sizing: border-box;
    width: 32rem;
    padding: 1.6rem;
    border: 1px solid ${LINE};
    border-radius: 1.2rem;
    background: ${PANEL};
    box-shadow: 0 1.2rem 3.2rem rgba(0, 0, 0, 0.4);
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
`;

/** The 24h ring of call 00: track, hour ticks and labels every three hours. */
export const ringBase = () => {
  const ticks = Array.from({ length: 24 }, (_, hour) => {
    const outer = point(hour, 24, 94);
    const inner = point(hour, 24, hour % 3 === 0 ? 88 : 91);
    return `<line x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" />`;
  }).join('');

  const labels = [0, 3, 6, 9, 12, 15, 18, 21]
    .map((hour) => {
      const at = point(hour, 24, 74);
      return `<text x="${at.x}" y="${at.y}">${pad(hour)}</text>`;
    })
    .join('');

  return `
    <circle class="track" cx="${CENTER}" cy="${CENTER}" r="112" />
    <g class="ticks">${ticks}</g>
    <g class="labels">${labels}</g>
  `;
};

export const ringStyles = css`
  .track {
    fill: none;
    stroke: ${LINE};
    stroke-width: 28;
  }

  .ticks line {
    stroke: ${MUTED};
    stroke-width: 1;
  }

  .labels text {
    fill: ${MUTED};
    font-size: 11px;
  }

  .hand {
    stroke: ${ACCENT};
    stroke-width: 2;
  }

  .pivot {
    fill: ${ACCENT};
  }

  .handle {
    fill: ${ACCENT};
    stroke: ${GROUND};
    stroke-width: 3;
  }
`;
