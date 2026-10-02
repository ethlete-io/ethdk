import { css, html } from '@design-explore';

type Rgb = [number, number, number];

export type Treatment = {
  titleWeight: number;
  secondaryOpacity: number;
  secondary: 'ink' | 'surface';
};

type Theme = { name: string; fill: Rgb; ink: Rgb; onFill: Rgb };
type Surface = { name: string; background: Rgb; color: Rgb; themes: Theme[] };

const DARK_TEXT: Rgb = [23, 23, 23];
const WHITE: Rgb = [255, 255, 255];

const SURFACES: Surface[] = [
  {
    name: 'dark',
    background: [23, 23, 23],
    color: [250, 250, 250],
    themes: [
      { name: 'brand', fill: [0, 255, 161], ink: [0, 255, 161], onFill: [0, 0, 0] },
      { name: 'success', fill: [22, 163, 74], ink: [74, 222, 128], onFill: DARK_TEXT },
      { name: 'warning', fill: [217, 119, 6], ink: [217, 119, 6], onFill: DARK_TEXT },
      { name: 'danger', fill: [220, 38, 38], ink: [248, 113, 113], onFill: WHITE },
    ],
  },
  {
    name: 'light',
    background: [255, 255, 255],
    color: [23, 23, 23],
    themes: [
      { name: 'brand', fill: [0, 255, 161], ink: [4, 120, 87], onFill: [0, 0, 0] },
      { name: 'success', fill: [22, 163, 74], ink: [22, 101, 52], onFill: DARK_TEXT },
      { name: 'warning', fill: [217, 119, 6], ink: [146, 64, 14], onFill: DARK_TEXT },
      { name: 'danger', fill: [220, 38, 38], ink: [185, 28, 28], onFill: WHITE },
    ],
  },
];

const APPOINTMENTS = [
  { title: 'Client call: Globex', time: '11:00–12:00', location: 'Zoom' },
  { title: '1:1 with manager', time: '13:00–13:30', location: 'Room 2' },
  { title: 'Sprint planning', time: '14:00–15:30', location: 'Office' },
  { title: 'Retro', time: '16:00–17:00', location: 'Zoom' },
];

const TINT = 0.14;

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

const chip = (treatment: Treatment, surface: Surface, theme: Theme, index: number, selected: boolean) => {
  const appointment = APPOINTMENTS[index]!;
  const background = selected ? theme.fill : mix(theme.fill, surface.background, TINT);
  const title = selected ? theme.onFill : theme.ink;
  const secondaryBase = selected ? theme.onFill : treatment.secondary === 'surface' ? surface.color : theme.ink;
  const secondary = mix(secondaryBase, background, treatment.secondaryOpacity);
  return html`<div class="line">
    <span class="chip" style="background:${rgb(background)};color:${rgb(title)}">
      <span class="dot" style="background:${rgb(selected ? theme.onFill : theme.fill)}"></span>
      <span class="title" style="font-weight:${treatment.titleWeight}">${appointment.title}</span>
      <span class="secondary" style="color:${rgb(secondary)}">${appointment.time}</span>
      <span class="secondary" style="color:${rgb(secondary)}">${appointment.location}</span>
    </span>
    ${ratio('title', contrast(title, background))} ${ratio('time', contrast(secondary, background))}
  </div>`;
};

export const sheet = (treatment: Treatment) => html`
  ${SURFACES.map(
    (surface) =>
      html`<section class="surface" style="background:${rgb(surface.background)}">
        <h3>${surface.name}</h3>
        ${surface.themes.map((theme, index) => chip(treatment, surface, theme, index, false))}
        ${chip(treatment, surface, surface.themes[0]!, 0, true)}
      </section>`,
  )}
`;

export const frameStyles = css`
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
  .surface {
    display: grid;
    gap: 6px;
    padding: 16px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: rgb(115 115 115);
  }
  .line {
    display: grid;
    grid-template-columns: 340px 80px 80px;
    align-items: center;
    gap: 8px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
  .dot {
    flex-shrink: 0;
    inline-size: 6px;
    block-size: 6px;
    border-radius: 999px;
  }
  .title {
    overflow: hidden;
    flex: 1;
    min-inline-size: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .secondary {
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
