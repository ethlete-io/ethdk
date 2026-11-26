import { css, html } from '@design-explore';

type Rgb = [number, number, number];

export type Option = {
  code: string;
  light: Rgb;
  dark: Rgb;
};

const BRAND: Rgb = [0, 255, 161];
const BRAND_ON_LIGHT: Rgb = [4, 120, 87];

export const INK = {
  brand: BRAND,
  brandOnLight: BRAND_ON_LIGHT,
  lightText: [23, 23, 23] as Rgb,
  darkText: [250, 250, 250] as Rgb,
};

const SURFACES = [
  { name: 'light', background: [255, 255, 255] as Rgb, key: 'light' as const },
  { name: 'dark', background: [23, 23, 23] as Rgb, key: 'dark' as const },
];

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

export const sheet = (option: Option) => html`
  <pre class="code">${option.code}</pre>
  <div class="row">
    ${SURFACES.map((surface) => {
      const ink = option[surface.key];
      return html`<section class="surface" style="background:${rgb(surface.background)}">
        <h3>${surface.name}</h3>
        <span class="button" style="color:${rgb(ink)};border-color:${rgb(ink)}">Today</span>
        ${ratio(contrast(ink, surface.background))}
      </section>`;
    })}
  </div>
`;

export const frameStyles = css`
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
  .code {
    margin: 0;
    padding: 12px 16px;
    background: rgb(245 245 245);
    color: rgb(23 23 23);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .surface {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }
  h3 {
    margin: 0;
    inline-size: 40px;
    font-size: 12px;
    font-weight: 600;
    color: rgb(115 115 115);
  }
  .button {
    padding: 4px 12px;
    border: 1px solid;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
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
