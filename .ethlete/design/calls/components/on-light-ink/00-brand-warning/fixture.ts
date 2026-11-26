import { css, html } from '@design-explore';

type Rgb = [number, number, number];

export type Inks = { brand: Rgb; warning: Rgb };

const FILLS = { brand: [0, 255, 161] as Rgb, warning: [217, 119, 6] as Rgb };
const ON_FILL = { brand: [0, 0, 0] as Rgb, warning: [255, 255, 255] as Rgb };
const SURFACES: { name: string; background: Rgb }[] = [
  { name: 'light', background: [255, 255, 255] },
  { name: 'light-elevated', background: [250, 250, 250] },
];
const TONAL_OPACITY = 0.16;

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

const mix = (fg: Rgb, bg: Rgb, alpha: number) => fg.map((v, i) => Math.round(v * alpha + bg[i]! * (1 - alpha))) as Rgb;

const rgb = (color: Rgb) => `rgb(${color.join(' ')})`;

const ratio = (value: number) => html`<span class="ratio ${value < 4.5 ? 'fail' : ''}">${value.toFixed(2)}</span>`;

const badge = (label: string, style: string, value: number) =>
  html`<span class="cell"><span class="badge" style="${style}">${label}</span>${ratio(value)}</span>`;

const row = (theme: keyof Inks, inks: Inks, background: Rgb) => {
  const ink = inks[theme];
  const fill = FILLS[theme];
  const tonal = mix(fill, background, TONAL_OPACITY);
  return html`<div class="row">
    <span class="theme">${theme}</span>
    ${badge('Filled', `background:${rgb(fill)};color:${rgb(ON_FILL[theme])}`, contrast(ON_FILL[theme], fill))}
    ${badge('Tonal', `background:${rgb(tonal)};color:${rgb(ink)}`, contrast(ink, tonal))}
    ${badge('Outline', `border-color:${rgb(ink)};color:${rgb(ink)}`, contrast(ink, background))}
    <span class="ink">ink ${ink.join(' ')}</span>
  </div>`;
};

export const sheet = (inks: Inks) => html`
  ${SURFACES.map(
    (surface) =>
      html`<section class="surface" style="background:${rgb(surface.background)}">
        <h3>${surface.name}</h3>
        ${row('brand', inks, surface.background)} ${row('warning', inks, surface.background)}
      </section>`,
  )}
`;

export const frameStyles = css`
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
    color: rgb(23 23 23);
  }
  .surface {
    padding: 16px;
    border-block-end: 1px solid rgb(229 229 229);
  }
  h3 {
    margin: 0 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgb(115 115 115);
  }
  .row {
    display: grid;
    grid-template-columns: 72px repeat(3, 120px) auto;
    align-items: center;
    gap: 12px;
    margin-block-end: 10px;
  }
  .theme,
  .ink {
    font-size: 12px;
    color: rgb(115 115 115);
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
    border: 1px solid transparent;
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
  .ratio.fail {
    color: rgb(185 28 28);
    font-weight: 700;
  }
`;
