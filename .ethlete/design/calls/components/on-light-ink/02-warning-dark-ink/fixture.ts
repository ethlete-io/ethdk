import { css, html } from '@design-explore';

export type Rgb = [number, number, number];

const FILL: Rgb = [217, 119, 6];
const SURFACES: { name: string; background: Rgb }[] = [
  { name: 'dark', background: [23, 23, 23] },
  { name: 'dark-elevated', background: [38, 38, 38] },
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

const mix = (fg: Rgb, bg: Rgb, alpha: number) => fg.map((v, i) => v * alpha + bg[i]! * (1 - alpha)) as Rgb;

const rgb = (color: Rgb) => `rgb(${color.map(Math.round).join(' ')})`;

const ratio = (value: number) => html`<span class="ratio ${value < 4.5 ? 'fail' : ''}">${value.toFixed(2)}</span>`;

const item = (content: unknown, value: number) => html`<span class="cell">${content}${ratio(value)}</span>`;

export const sheet = (ink: Rgb) => html`
  ${SURFACES.map((surface) => {
    const tonal = mix(FILL, surface.background, 0.16);
    const chip = mix(FILL, surface.background, 0.14);
    return html`<section class="surface" style="background:${rgb(surface.background)}">
      <h3>${surface.name} · ink ${ink.join(' ')}</h3>
      <div class="row">
        ${item(html`<span class="badge" style="background:${rgb(tonal)};color:${rgb(ink)}">Pending</span>`, contrast(ink, tonal))}
        ${item(html`<span class="badge" style="border-color:${rgb(ink)};color:${rgb(ink)}">Pending</span>`, contrast(ink, surface.background))}
        ${item(
          html`<span class="chip" style="background:${rgb(chip)};color:${rgb(ink)}"
            ><span class="dot" style="background:${rgb(FILL)}"></span><b>Sprint planning</b
            ><span>14:00–15:30</span></span
          >`,
          contrast(ink, chip),
        )}
        ${item(html`<span class="text" style="color:${rgb(ink)}">3 items need review</span>`, contrast(ink, surface.background))}
      </div>
    </section>`;
  })}
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
    color: rgb(161 161 161);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
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
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
  .dot {
    inline-size: 6px;
    block-size: 6px;
    border-radius: 999px;
  }
  .text {
    font-size: 13px;
  }
  .ratio {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: rgb(161 161 161);
  }
  .ratio.fail {
    color: rgb(248 113 113);
    font-weight: 700;
  }
`;
