import { css, html } from '@design-explore';

export type Rgb = [number, number, number];

export type Surface = { name: string; background: Rgb; color: Rgb; muted: Rgb; subtle: Rgb; border: Rgb };

export const SURFACES: Record<string, Surface> = {
  light: {
    name: 'light',
    background: [255, 255, 255],
    color: [23, 23, 23],
    muted: [115, 115, 115],
    subtle: [161, 161, 161],
    border: [229, 229, 229],
  },
  lightElevated: {
    name: 'light-elevated',
    background: [250, 250, 250],
    color: [23, 23, 23],
    muted: [115, 115, 115],
    subtle: [161, 161, 161],
    border: [229, 229, 229],
  },
  dark: {
    name: 'dark',
    background: [23, 23, 23],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [64, 64, 64],
  },
  darkElevated: {
    name: 'dark-elevated',
    background: [38, 38, 38],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [64, 64, 64],
  },
  darkElevated2: {
    name: 'dark-elevated-2',
    background: [64, 64, 64],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [82, 82, 82],
  },
  darkElevated3: {
    name: 'dark-elevated-3',
    background: [90, 90, 90],
    color: [250, 250, 250],
    muted: [161, 161, 161],
    subtle: [115, 115, 115],
    border: [110, 110, 110],
  },
};

const luminance = (color: Rgb) => {
  const [r, g, b] = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: Rgb, b: Rgb) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
};

export const mix = (fg: Rgb, bg: Rgb, alpha: number) => fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as Rgb;

export const rgb = (color: Rgb) => `rgb(${color.map(Math.round).join(' ')})`;

export const ratio = (label: string, value: number) =>
  html`<span class="ratio ${value < 4.5 ? 'fail' : ''}">${label} ${value.toFixed(2)}</span>`;

export const baseStyles = css`
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
