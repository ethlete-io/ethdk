import { css, html } from '@design-explore';

type Rgb = [number, number, number];

export type Treatment = {
  tone: 'subtle' | 'muted';
  weight: number;
  shade: number;
};

type Surface = { name: string; background: Rgb; color: Rgb; muted: Rgb; subtle: Rgb; border: Rgb };

const SURFACES: Surface[] = [
  {
    name: 'light',
    background: [255, 255, 255],
    color: [23, 23, 23],
    muted: [115, 115, 115],
    subtle: [161, 161, 161],
    border: [229, 229, 229],
  },
  {
    name: 'light-elevated',
    background: [250, 250, 250],
    color: [23, 23, 23],
    muted: [115, 115, 115],
    subtle: [161, 161, 161],
    border: [229, 229, 229],
  },
  {
    name: 'dark',
    background: [23, 23, 23],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [64, 64, 64],
  },
  {
    name: 'dark-elevated',
    background: [38, 38, 38],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [64, 64, 64],
  },
];

const WEEKS = [
  [28, 29, 30, 1, 2, 3, 4],
  [26, 27, 28, 29, 30, 31, 1],
];

const isOutside = (week: number, day: number) => (week === 0 ? day > 20 : day < 10);

const luminance = (color: Rgb) => {
  const [r, g, b] = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
};

const mix = (fg: Rgb, bg: Rgb, alpha: number) => fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as Rgb;

const rgb = (color: Rgb) => `rgb(${color.map(Math.round).join(' ')})`;

const ratio = (label: string, value: number) =>
  html`<span class="ratio ${value < 4.5 ? 'fail' : ''}">${label} ${value.toFixed(2)}</span>`;

const panel = (treatment: Treatment, surface: Surface) => {
  const outsideBackground = mix(surface.color, surface.background, treatment.shade);
  const outsideColor = treatment.tone === 'muted' ? surface.muted : surface.subtle;
  return html`<section class="surface" style="background:${rgb(surface.background)};color:${rgb(surface.color)}">
    <h3>${surface.name}</h3>
    <div class="grid" style="--border:${rgb(surface.border)}">
      ${WEEKS.map((week, weekIndex) =>
        week.map((day) => {
          const outside = isOutside(weekIndex, day);
          return html`<div class="cell" style="${outside ? `background:${rgb(outsideBackground)}` : ''}">
            <span class="date" style="${outside ? `color:${rgb(outsideColor)};font-weight:${treatment.weight}` : ''}"
              >${day}</span
            >
          </div>`;
        }),
      )}
    </div>
    <div class="ratios">
      ${ratio('outside', contrast(outsideColor, outsideBackground))}
      ${ratio('in month', contrast(surface.color, surface.background))}
    </div>
  </section>`;
};

export const sheet = (treatment: Treatment) => html`${SURFACES.map((surface) => panel(treatment, surface))}`;

export const frameStyles = css`
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
  .surface {
    display: grid;
    gap: 6px;
    padding: 12px 16px;
  }
  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: rgb(115 115 115);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-inline-start: 1px solid var(--border);
    border-block-start: 1px solid var(--border);
  }
  .cell {
    block-size: 44px;
    padding: 4px;
    border-inline-end: 1px solid var(--border);
    border-block-end: 1px solid var(--border);
  }
  .date {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 22px;
    block-size: 22px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .ratios {
    display: flex;
    gap: 12px;
  }
  .ratio {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: rgb(115 115 115);
  }
  .ratio.fail {
    color: rgb(239 68 68);
    font-weight: 700;
  }
`;
