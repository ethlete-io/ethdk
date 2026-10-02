import { css, html } from '@design-explore';

type Rgb = [number, number, number];

export type Theme = 'brand' | 'success' | 'warning' | 'danger';
export type Filled = Record<Theme, { fill: Rgb; text: Rgb }>;

export const WHITE: Rgb = [255, 255, 255];
export const NEUTRAL_900: Rgb = [23, 23, 23];

export const SHIPPED: Filled = {
  brand: { fill: [0, 255, 161], text: [0, 0, 0] },
  success: { fill: [22, 163, 74], text: WHITE },
  warning: { fill: [217, 119, 6], text: WHITE },
  danger: { fill: [220, 38, 38], text: WHITE },
};

const SURFACES: { name: string; background: Rgb }[] = [
  { name: 'dark', background: [23, 23, 23] },
  { name: 'dark-elevated', background: [38, 38, 38] },
  { name: 'light', background: [255, 255, 255] },
  { name: 'light-elevated', background: [250, 250, 250] },
];

const LABELS: Record<Theme, string> = { brand: 'Brand', success: 'Active', warning: 'Pending', danger: '3 errors' };

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

const rgb = (color: Rgb) => `rgb(${color.join(' ')})`;

const ratio = (value: number) => html`<span class="ratio ${value < 4.5 ? 'fail' : ''}">${value.toFixed(2)}</span>`;

const cell = (theme: Theme, filled: Filled) => {
  const { fill, text } = filled[theme];
  return html`<span class="cell"
    ><span class="badge" style="background:${rgb(fill)};color:${rgb(text)}">${LABELS[theme]}</span
    >${ratio(contrast(text, fill))}</span
  >`;
};

export const sheet = (filled: Filled) => html`
  ${SURFACES.map(
    (surface) =>
      html`<section
        class="surface ${surface.name.startsWith('dark') ? 'on-dark' : ''}"
        style="background:${rgb(surface.background)}"
      >
        <h3>${surface.name}</h3>
        <div class="row">${(Object.keys(LABELS) as Theme[]).map((theme) => cell(theme, filled))}</div>
      </section>`,
  )}
`;

export const frameStyles = css`
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
  .surface {
    padding: 16px;
  }
  h3 {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgb(115 115 115);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
  .cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    min-block-size: 24px;
    padding-inline: 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
  }
  .ratio {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: rgb(115 115 115);
  }
  .on-dark .ratio {
    color: rgb(161 161 161);
  }
  .ratio.fail {
    color: rgb(239 68 68);
    font-weight: 700;
  }
`;
